---
title: "Redis 的边界：验证码、限流与缓存"
description: "从 MindType 的真实用法出发：验证码 TTL、一次性校验、单机限流的局限、Cache-Aside 的竞态，以及 Redis 故障时的降级策略。"
pubDate: 2026-10-30
updatedDate: 2026-10-31
tags: ["Redis", "Java", "Spring Boot", "MySQL"]
cover: "/covers/redis-boundary.svg"
coverAlt: "Redis 键、倒计时与缓存层组成的边界主题封面"
featured: true
draft: false
---

Redis 很容易被当成“加一个缓存就快了”的万能层。真正上线后，问题往往不在命令会不会写，而在边界有没有定义：这份数据丢了能不能重建、验证码能不能被重复使用、限流在多实例下还算不算数、缓存删除失败时旧值会存在多久。

MindType 的短信验证码与发送限流就踩过这些边界。生产环境用 Redis 存验证码和计数，开发环境没有 Redis 时回退到本地内存；同一条业务链路有两套实现，正好把“单机能用”和“多机能用”的差别暴露出来。

![Redis 键与缓存层的边界示意](/covers/redis-boundary.svg)

## 先区分三种角色

Redis 里的数据至少有三类，生命周期和失败后果完全不同：

- **缓存**：从数据库或下游计算得到，丢了可以重建。关键是 TTL、回源成本和一致性窗口。
- **临时状态**：验证码、一次性令牌、会话快照。丢了通常意味着用户要重新操作，TTL 和原子性比容量更重要。
- **协调状态**：限流计数、分布式锁、去重标记。丢了可能放大流量或破坏互斥，必须明确多实例下的语义。

把三类混在一起，就会出现“缓存过期时间随手设 24 小时”“验证码 key 没有 TTL”“限流只在当前进程生效”这类问题。先问这份数据属于哪一类，再决定 key、TTL 和失败策略，比先选 Redis 数据结构更重要。

## 验证码：TTL 与一次性校验

MindType 的 `SmsCodeService` 使用 `sms:code:{mobile}` 作为键，生成 6 位数字后以 5 分钟 TTL 写入 Redis。校验成功后立即删除，保证一条验证码只能用一次。

```java
String key = "sms:code:" + mobile;
redisTemplate.opsForValue().set(key, code, Duration.ofMinutes(5));

String stored = redisTemplate.opsForValue().get(key);
if (stored != null && stored.equals(code)) {
    redisTemplate.delete(key);
    return true;
}
return false;
```

这段代码在低并发下没问题，但 `GET` 和 `DEL` 是两条命令，不是原子操作。两个请求同时拿到同一个验证码，都可能通过校验；如果其中一个已经删掉 key，另一个仍可能拿着旧值继续。更稳妥的是用 Lua 把“比较 + 删除”放在一次执行里：

```lua
local stored = redis.call('GET', KEYS[1])
if stored == ARGV[1] then
  redis.call('DEL', KEYS[1])
  return 1
end
return 0
```

验证码还有几个容易漏掉的边界：

- 重新发送时应覆盖旧 key，旧验证码立即失效，而不是等 TTL 自然过期。
- 失败尝试要有独立计数，否则攻击者可以在 5 分钟内无限猜 6 位数字。可以用 `sms:code:fail:{mobile}` 计数，超过阈值后锁定一段时间。
- 日志不要打印验证码本身。MindType 只记录脱敏手机号和 TTL，这是正确的方向。
- `hasCode` 只能用于判断是否在冷却期，不能代替校验；key 存在不代表用户输入正确。

## 限流：单机计数与全局计数

MindType 有两套短信限流：生产环境用 `SmsRateLimitService` 走 Redis，开发环境回退到 `RateLimitService` 的 `ConcurrentHashMap`。规则是同一手机号 1 次/分钟、同一 IP 5 次/小时。

本地 Map 的优点是没有外部依赖，缺点是只在当前进程内有效。应用部署两个实例后，同一手机号在两个实例上各发一次，实际限制就变成了 2 次/分钟；实例越多，偏差越大。单实例个人项目可以接受，多实例就必须迁到 Redis 或其他共享存储。

Redis 版本的实现是 `INCR` 加 `EXPIRE`：

```java
Long count = redisTemplate.opsForValue().increment(key);
if (count != null && count == 1) {
    redisTemplate.expire(key, window);
}
return count != null && count <= max;
```

问题在于 `INCR` 和 `EXPIRE` 不是原子的。如果进程在两条命令之间崩溃，key 会永久保留，用户可能被永久限流；如果第一次请求的 `EXPIRE` 失败，后续计数也没有窗口边界。注释里写的是“滑动窗口”，实现其实是固定窗口：窗口切换的瞬间，前后两秒可能放过两倍流量。

更稳妥的写法是用 Lua 把计数和过期放在一次执行里：

```lua
local current = redis.call('INCR', KEYS[1])
if current == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
if current > tonumber(ARGV[2]) then
  return 0
end
return 1
```

固定窗口简单、成本低，适合大多数短信场景；如果需要更平滑的限制，可以用滑动日志或令牌桶，但要接受更高的存储和计算成本。限流触发时返回 429，并带上 `Retry-After`，不要用 400 或 500 让客户端猜。

## 缓存：先更新数据库，再删除缓存

缓存最常用的模式是 Cache-Aside：读时先查缓存，未命中就回源数据库并写回；写时更新数据库，再删除缓存。删除而不是更新缓存，是因为缓存值可能是计算出来的、可能包含多个字段，直接更新容易漏字段，也会带来写放大。

```java
public AssessmentResult getResult(long id) {
    String key = "result:" + id;
    String cached = redis.opsForValue().get(key);
    if (cached != null) {
        return json.read(cached, AssessmentResult.class);
    }
    AssessmentResult result = repository.findById(id);
    if (result == null) {
        redis.opsForValue().set(key, EMPTY_MARKER, Duration.ofSeconds(30));
        return null;
    }
    redis.opsForValue().set(key, json.write(result), ttlWithJitter(Duration.ofMinutes(10)));
    return result;
}
```

“先更新数据库，再删除缓存”仍然不是强一致。一个典型交错是：读请求未命中，读到数据库旧值；写请求更新数据库并删除缓存；读请求随后把旧值写回缓存。旧值会一直存在到 TTL 过期。延迟双删能降低概率，但不是证明；版本化 key、binlog 订阅或对关键读加锁，才能把窗口进一步收紧。

对大多数展示型数据，接受秒级旧值 + 短 TTL 是合理选择。对余额、库存、权限这类数据，缓存不应是事实来源，读写都应回到数据库事务；缓存只做展示加速，并在写后删除。先定义“旧值最多存在多久”，再选方案，比争论“先删还是后删”更有效。

`@Cacheable` 也要注意事务边界。方法在事务提交前写入缓存，其他请求可能读到尚未提交的数据；自调用还会绕过代理。对一致性敏感的数据，可以在事务提交后显式删除缓存，或把缓存操作放到独立的提交后回调里，而不是完全依赖注解。

## 穿透、击穿与雪崩

- **穿透**：查询不存在的数据，每次都打到数据库。可以缓存空值（短 TTL），或用布隆过滤器挡住明显不存在的 key；前提是空值标记不会和真实值冲突。
- **击穿**：热点 key 过期瞬间，大量请求同时回源。可以用单飞（singleflight）或 `SET NX PX` 锁，只让一个请求重建，其余请求等待并二次检查缓存。
- **雪崩**：大量 key 同时过期，或 Redis 整体不可用。TTL 加随机抖动、预热、熔断和降级读数据库，比单纯延长 TTL 更实际。
- **热 key**：单个 key 被极高并发访问。可以加本地缓存、拆分 key 或读副本，但要注意本地缓存的一致性窗口。

重建锁要设置过期时间，释放时用 Lua 比较 token，避免误删别的请求刚拿到的锁：

```lua
if redis.call('GET', KEYS[1]) == ARGV[1] then
  return redis.call('DEL', KEYS[1])
else
  return 0
end
```

锁只保护重建，不应该包住整个业务读。拿不到锁的请求可以短暂等待后重查缓存，或直接回源但限制并发；让所有请求排队等一个慢查询，会把局部问题放大成整体延迟。

## 可观测与降级

Redis 出问题时，最危险的不是慢，而是“以为它还在工作”。至少关注这些指标：

- `INFO stats` 的 `keyspace_hits` / `keyspace_misses`，判断缓存是否真的有效。
- `SLOWLOG GET` 与 `LATENCY DOCTOR`，定位慢命令和阻塞。
- `MEMORY USAGE`、`--bigkeys`，避免大 key 删除或读取拖住主线程。
- 连接数、拒绝命令、淘汰数量，判断容量是否已经越界。

降级策略要按数据类型分别定义。缓存不可用时可以回源数据库，但要限制并发、加超时和熔断，避免重试风暴；验证码不可用时通常应失败关闭，而不是放行；限流不可用时可以回退到本地限流，但要接受多实例下的偏差。最糟糕的是捕获异常后静默返回成功，让安全边界悄悄消失。

## 检查清单

- 这份数据是缓存、临时状态还是协调状态？丢了会发生什么？
- 每个 key 是否都有明确 TTL？是否存在“第一次 INCR 后没设过期”的路径？
- 验证码校验是否原子、一次性、有失败次数限制？重发是否会覆盖旧值？
- 限流是单机还是全局？多实例部署后实际额度会变成多少？
- 缓存写入是否发生在事务提交之后？删除失败是否有重试或补偿？
- 热点 key 过期时，是否只有一个请求回源？
- Redis 不可用时，每类数据是回源、失败关闭还是本地降级？
- 命中率、慢命令、大 key 和内存水位是否有监控？

Redis 的价值不在于“多了一个快存储”，而在于把 TTL、原子性和失败策略变成显式代码。边界写清楚之后，缓存才是加速；写不清楚，它只是把问题延迟到更难复现的时刻。
