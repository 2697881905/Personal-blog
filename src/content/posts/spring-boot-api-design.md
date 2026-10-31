---
title: "Spring Boot 接口设计：把边界写清楚"
description: "拿 MindType 的接口逐条对照：错误码、HMAC 令牌、幂等下单和分页，哪些能直接复用，哪些是反面例子。"
pubDate: 2025-02-18
updatedDate: 2026-10-31
tags: ["Java", "Spring Boot", "Spring MVC"]
cover: "/covers/spring-boot.svg"
coverAlt: "分层请求、领域与响应线框组成的 Spring Boot 接口设计封面"
featured: true
draft: false
---

接口是服务对外的契约。控制器能跑只是最低要求，真正影响协作效率的是：调用方能否仅凭路径、字段和状态码预测行为。设计时先明确资源与边界，再讨论框架注解，避免让实现细节反向绑架 API。

下面会拿 MindType（[Gitee 仓库](https://gitee.com/bai-yi-fei/mind-type)）的真实接口做对照：它是一个 Spring Boot 3.3 + MyBatis-Plus 的小型商业项目，包含测评、支付、后台与多端前端，接口边界的问题比示例工程更具体。

![Spring Boot 接口设计的分层结构](/covers/spring-boot.svg)

## 从资源和状态开始

REST 风格并不要求机械套用某种 URL 模板，但资源命名能显著减少歧义。订单、商品、库存通常使用复数名词表达，查询、创建、更新交给 HTTP 方法。`/orders/{id}` 比 `/getOrderById` 更稳定，因为标识订单的方式不随业务实现变化。

业务动作无法自然映射为增删改查时，可以把动作建模为资源。取消订单可以表达为 `POST /orders/{id}/cancellation`，而不是在查询参数里混入操作类型。这样既保留语义，也便于统一鉴权、记录审计日志。异步任务可以返回 `202 Accepted` 和任务地址，让调用方轮询或订阅结果，而不是让一个 HTTP 请求长时间挂起。

方法语义要诚实。`GET` 不产生副作用；`PUT` 是完整替换，重复执行结果相同；`PATCH` 是局部修改，是否幂等取决于补丁内容；`DELETE` 通常幂等，但第二次调用可能返回 `204` 或 `404`，团队需要统一。路径描述“操作什么”，方法描述“如何操作”，状态码说明“结果如何”。

状态码不要混用。参数格式错误是 `400`，未认证是 `401`，已认证但无权限是 `403`，资源不存在是 `404`，与当前状态冲突是 `409`，限流是 `429`，服务端未预期异常是 `5xx`。语义校验失败可以用 `422`，但同一类错误不要在 `400` 和 `422` 之间摇摆；调用方需要稳定分支，而不是猜文案。

## 用 DTO 固定输入输出

不要直接暴露持久化实体。数据库字段、关联对象和序列化策略一旦变化，就可能意外修改公开契约。请求 DTO 负责声明允许的输入，响应 DTO 负责呈现稳定字段，两者都不应携带与当前场景无关的信息。

```java
public record CreateOrderRequest(
        @NotBlank String productCode,
        @Positive int quantity
) {}

public record OrderResponse(
        long id,
        String status,
        long amountInCents,
        String currency,
        OffsetDateTime createdAt
) {}

@PostMapping("/orders")
public ResponseEntity<OrderResponse> create(
        @Valid @RequestBody CreateOrderRequest request) {
    OrderResponse response = orderService.create(request);
    URI location = URI.create("/orders/" + response.id());
    return ResponseEntity.created(location).body(response);
}
```

字段命名应统一使用一种风格，时间格式、金额单位和空值语义也要明确。金额可以传输最小货币单位的整数，避免浮点误差；时间建议采用带时区的 ISO 8601 字符串。数据库里的 `datetime` 不带时区，跨系统传递前要明确它代表哪个时区，否则同一个值会在不同服务里变成不同时刻。

校验注解适合检查格式与范围，跨字段规则及库存等业务约束仍应放在领域逻辑中。`@Valid` 只负责把请求挡在边界外，不能替代“订单是否允许取消”“库存是否足够”这类状态判断。`@JsonIgnore` 也不是安全边界：响应 DTO 才是。

枚举演进要提前考虑。数据库存字符串而不是序号，新增枚举值不会让旧数据错位；客户端遇到未知值时，应该能降级显示而不是直接崩溃。对于 `PATCH`，还要区分“字段缺失”和“字段显式为 null”：前者表示不修改，后者可能表示清空。这个语义不写清楚，前后端就会在空值上反复扯皮。

> 好的接口路径描述“操作什么”，HTTP 方法描述“如何操作”，状态码则说明“结果如何”。

## 让错误可以被程序处理

统一错误结构比统一“成功包装”更重要。调用方需要稳定的错误码、可读的说明，以及用于排查的追踪标识。参数错误、资源不存在、权限不足和系统异常不能使用同一种状态码，否则客户端只能依赖模糊文案分支处理。

Spring Boot 3 可以借助 `ProblemDetail` 输出接近 RFC 9457 的错误响应。业务错误码单独定义并保持稳定，不要直接复用异常类名。

```java
@RestControllerAdvice
class ApiExceptionHandler {

    @ExceptionHandler(OrderNotFoundException.class)
    ProblemDetail handleNotFound(OrderNotFoundException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.NOT_FOUND, "order not found");
        problem.setTitle("Order not found");
        problem.setType(URI.create("https://example.com/problems/order-not-found"));
        problem.setProperty("code", "ORDER_NOT_FOUND");
        problem.setProperty("traceId", MDC.get("traceId"));
        return problem;
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    ProblemDetail handleValidation(MethodArgumentNotValidException ex) {
        ProblemDetail problem = ProblemDetail.forStatusAndDetail(
                HttpStatus.BAD_REQUEST, "request validation failed");
        problem.setTitle("Invalid request");
        problem.setProperty("code", "VALIDATION_FAILED");
        problem.setProperty("errors", ex.getBindingResult().getFieldErrors().stream()
                .collect(Collectors.toMap(
                        FieldError::getField,
                        error -> Objects.requireNonNullElse(error.getDefaultMessage(), "invalid"),
                        (first, second) -> first)));
        return problem;
    }
}
```

响应只暴露必要信息。堆栈、SQL、内部主机名和下游服务地址应该留在日志里，并通过 `traceId` 关联。错误码用于程序判断，`detail` 用于人阅读，两者不要互相替代。权限失败也不要泄露资源是否存在：对无权查看的订单返回 `404` 还是 `403`，取决于是否允许调用方探测资源存在性，这属于安全策略，不只是 HTTP 细节。

不是所有项目都要用 `ProblemDetail`。MindType 用的是自定义 `ApiResponse(code, message, data, timestamp)`，`GlobalExceptionHandler` 再把 `BusinessException` 的 401、403、404、429 映射到对应 HTTP 状态。这样客户端既能用 HTTP 状态做通用处理，也能用业务码做细分分支。

这里有一个值得记录的边界：MindType 的短信限流在 Redis 路径抛 `BusinessException(429)`，在本地回退路径却抛 `BusinessException(1)`；前者映射为 HTTP 429，后者落到默认 400。同一语义出现两种状态码，调用方按状态码分支就会漏掉。错误映射应集中在一处，限流统一成 429，业务码只用于更细的原因说明。

令牌格式也不是契约的全部。MindType 的访问令牌是 HMAC-SHA256 签名的 `userId|nickname|scope|expiresAt` 字符串，不是标准 JWT；只要签名、过期和作用域校验都在服务端完成，客户端就不需要关心里面怎么编码。不要把解析逻辑复制到客户端并据此信任权限，那只是把服务端的责任挪到了一个可被修改的地方。

## 幂等：超时后的第二次请求

网络超时不代表服务端没有处理成功。客户端重试创建订单，可能产生两条记录；重试扣减库存，可能多扣一次。创建类接口需要在契约里明确幂等语义，而不是指望调用方永不重试。

常见做法是让调用方生成 `Idempotency-Key` 请求头，服务端保存请求摘要和处理结果。相同的键加相同的请求体返回首次结果；相同的键配不同的请求体返回 `409`；首次请求仍在处理中时，可以返回 `409` 或 `202`，但不能静默再执行一次。

```sql
CREATE TABLE idempotency_record (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    idempotency_key VARCHAR(64) NOT NULL,
    request_hash CHAR(64) NOT NULL,
    status VARCHAR(16) NOT NULL,
    response_body JSON NULL,
    created_at DATETIME(3) NOT NULL,
    updated_at DATETIME(3) NOT NULL,
    UNIQUE KEY uk_idempotency_key (idempotency_key)
);
```

处理顺序可以拆成三段短事务：先插入 `processing` 记录占位；再执行业务事务；最后把结果写成 `completed`。并发的重复请求会在唯一键上竞争，失败的一方读取已有记录：已完成就重放响应，仍在处理就返回冲突，摘要不一致就直接拒绝。不要用一个长事务包住“占位 + 业务 + 完成”，否则并发请求会长时间等待，超时后又留下不一致的中间状态。

幂等键的保存周期、作用范围和清理策略也要写进契约。键通常按用户或租户隔离，避免不同租户猜中同一键；响应快照只保存重放必需的内容，避免把敏感数据长期留在幂等表里。数据库唯一约束仍然是最后一道保险：即使幂等层失效，业务唯一键也不能让重复数据落库。

MindType 的支付下单提供了一个真实样本：`PayService.loadOrCreateActiveOrder` 先按 `userId + recordId + channel + UNPAID` 查现有订单，存在且未过期就复用；`order_no` 在数据库里唯一；回调只在订单状态允许时推进一次，另有定时补偿任务处理掉单。它没有使用通用幂等表，而是用业务唯一键和状态机实现幂等。两种方案都可以，关键是明确幂等单位：是请求、订单，还是报告解锁。

反过来也有一个反例：MindType 的 `/submit` 每次提交都会把 `unlocked` 置回 `false` 并重新计分。如果客户端在超时后重试，已经解锁的报告会被覆盖。提交类接口应在状态机里区分“首次提交”和“重放”，至少不要无条件重置解锁状态。幂等不是给接口加一个请求头，而是把状态迁移规则写进领域逻辑。

对于更新类接口，幂等往往来自“绝对状态”而不是“增量”。`PUT /orders/{id}/status` 传 `CANCELLED` 重复执行结果相同；`POST /orders/{id}/cancel` 如果内部是“状态减一”，就不幂等。设计时优先表达目标状态，再在服务端判断状态机是否允许这次迁移。

## 分页、筛选与稳定排序

列表接口要约定排序规则。仅按非唯一字段排序，会让数据在翻页时重复或遗漏，因此追加唯一主键作为次级排序条件。数据量大且排序稳定时，游标分页通常比深分页更合适；需要跳页的中小型后台列表可以保留页码模式。

```java
public record PageResponse<T>(
        List<T> items,
        String nextCursor,
        boolean hasMore
) {}

@GetMapping("/orders")
public PageResponse<OrderResponse> list(
        @RequestParam(required = false) String cursor,
        @RequestParam(defaultValue = "20") @Max(100) int size) {
    return orderQueryService.list(cursor, size);
}
```

游标应该由服务端生成和解析，客户端只负责原样带回。把排序键编码进游标，下一页从确定位置继续，而不是重新数过前面的行。SQL 可以写成：

```sql
SELECT id, status, created_at, amount
FROM orders
WHERE tenant_id = ?
  AND (created_at < ?
       OR (created_at = ? AND id < ?))
ORDER BY created_at DESC, id DESC
LIMIT ?;
```

筛选参数要有白名单。`sort=amount desc` 这类自由文本如果直接拼进 SQL，既有注入风险，也会让索引设计失控。默认页大小、最大页大小、允许的排序字段和空结果语义都应写进文档。总数统计在深分页和大表上可能比列表本身更贵，可以改为返回 `hasMore`，或提供单独且带缓存的计数接口。

MindType 和有据的列表接口目前都使用 `page` / `limit`。有据首页按 `hotScore` 排序，页码分页配合固定排序也能工作。页码不是错误，问题在深分页和排序稳定性：后台列表需要跳页时可以保留页码，公开信息流在数据量上来后应评估游标。不要为了“先进”而把所有列表都改成游标，结果前端反而要自己维护一套位置状态。

分页和索引必须一起看。若索引顺序是 `(tenant_id, status, created_at)`，游标却按 `amount` 排序，数据库仍然需要额外排序。接口层规定了排序，数据库层就要有对应的访问路径；否则“游标分页”只是把深分页换了个名字。索引列的排列与验证方法见 [MySQL 索引设计](/posts/mysql-index-design/)。

## 版本演进与测试

契约演进优先采用新增可选字段、新增端点等向后兼容方式。删除字段、改变类型或收紧枚举含义都属于破坏性变更，应通过版本策略和弃用周期管理，而不是悄悄发布。即使只是把 `amount` 从元改成分，也必须视为破坏性变更，因为调用方的解释会整体偏移。

弃用要给出可执行的迁移路径：响应头标注弃用，文档写明替代字段和移除日期，日志里统计旧字段的调用量。只有确认没有消费者后，才真正删除。版本号放在路径里简单直接，但会带来双份维护；放在请求头里更隐蔽，也更容易被代理和缓存误处理。选择哪种方式取决于消费者数量，而不是个人偏好。

测试至少覆盖四类路径：正常创建与查询、参数校验失败、权限或状态冲突、幂等重放。控制器切片测试可以验证状态码、`Location` 头和错误结构；集成测试则用真实数据库验证唯一约束、事务边界和并发重复请求。MindType 用 H2 加嵌入式 Redis 跑集成测试，能在不依赖外部服务的情况下覆盖登录、限流和下单主链路；这类测试比只测 Controller 返回值更接近真实故障。

还有一个容易被忽略的测试面：对象级授权。把资源 ID 当授权凭证，是接口设计里最常见的漏洞之一。当 `userId` 为空时直接按 `recordId` 查询，可枚举的记录 ID 就变成了访问凭证。查询条件里应带上所有者，或明确匿名访问策略，并用“别人的 ID + 自己的身份”专门写一条测试。

```java
@Test
void createReturnsLocationAndBody() throws Exception {
    mockMvc.perform(post("/orders")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""
                            {"productCode":"SKU-1","quantity":2}
                            """))
            .andExpect(status().isCreated())
            .andExpect(header().exists("Location"))
            .andExpect(jsonPath("$.status").value("CREATED"));
}
```

对公开接口生成 OpenAPI 文档，并在持续集成中检查不兼容差异。文档、测试和实现共同描述同一份契约，接口才不至于随着迭代逐渐失去边界。

## 上线前的检查清单

- 路径是否用资源表达，动作是否被建模为子资源或状态迁移？
- 请求和响应是否是独立 DTO，是否避免了实体泄露？
- 金额、时间、空值和枚举的语义是否写清楚？
- 错误是否有稳定码、追踪标识和字段级信息？
- 创建类接口是否支持幂等重放，并发重复请求是否有唯一约束兜底？
- 列表排序是否稳定，分页方式是否与索引匹配？
- 破坏性变更是否有版本、弃用和迁移计划？
- 正常、校验失败、权限失败、状态冲突和重复请求是否都有测试？

接口设计没有统一模板，但有统一的检验标准：调用方能否在没有额外口头约定的情况下，正确使用、正确重试、正确识别失败。把这条标准守住，框架版本和注解风格反而都是次要的。
