<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const snippets = [
  'public static void main(String[] args) {',
  'SpringApplication.run(App.class, args);',
  'return ResponseEntity.ok("Hello, world");'
];

const snippetIndex = ref(0);
const charIndex = ref(0);
const deleting = ref(false);
let timer: number | undefined;

const typedText = computed(() => snippets[snippetIndex.value].slice(0, charIndex.value));

const tick = () => {
  const current = snippets[snippetIndex.value];

  if (!deleting.value && charIndex.value < current.length) {
    charIndex.value += 1;
    timer = window.setTimeout(tick, 72);
    return;
  }

  if (!deleting.value && charIndex.value === current.length) {
    deleting.value = true;
    timer = window.setTimeout(tick, 1300);
    return;
  }

  if (deleting.value && charIndex.value > 0) {
    charIndex.value -= 1;
    timer = window.setTimeout(tick, 34);
    return;
  }

  deleting.value = false;
  snippetIndex.value = (snippetIndex.value + 1) % snippets.length;
  timer = window.setTimeout(tick, 260);
};

onMounted(() => {
  timer = window.setTimeout(tick, 300);
});

onBeforeUnmount(() => {
  if (timer) {
    window.clearTimeout(timer);
  }
});
</script>

<template>
  <section id="about" class="liquid-surface liquid-surface-strong flex flex-col gap-2 rounded-2xl p-3 font-mono text-sm leading-6 sm:text-base">
    <div class="liquid-divider flex items-center justify-between gap-4 border-b pb-2">
      <div class="flex gap-2" aria-hidden="true">
        <span class="h-2.5 w-2.5 rounded-full bg-[#ff7b72]"></span>
        <span class="h-2.5 w-2.5 rounded-full bg-[#d29922]"></span>
        <span class="h-2.5 w-2.5 rounded-full bg-[#3fb950]"></span>
      </div>
      <span class="text-xs text-muted">src/main/java/App.java</span>
    </div>
    <div>
      <pre class="overflow-x-auto text-[#cfd6df]"><code>{{ typedText }}<span class="typing-cursor">_</span></code></pre>
    </div>
  </section>
</template>
