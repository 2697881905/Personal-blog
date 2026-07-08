<script setup lang="ts">
import { ref } from 'vue';

defineProps<{
  name: string;
  logo: string;
}>();

// Mobile: tap toggles the name label (no hover on touch devices)
const active = ref(false);
function toggle() {
  active.value = !active.value;
}
</script>

<template>
  <article
    class="liquid-surface-flat liquid-hover group relative flex aspect-square cursor-pointer items-center justify-center rounded-lg p-1 sm:rounded-xl sm:p-1.5 lg:rounded-2xl lg:p-2"
    :title="name"
    :aria-label="name"
    tabindex="0"
    @click="toggle"
    @keydown.enter.prevent="toggle"
    @keydown.space.prevent="toggle"
  >
    <img
      :src="logo"
      :alt="name"
      class="h-[82%] w-[82%] object-contain drop-shadow-[0_0_8px_rgba(255,255,255,0.20)] transition duration-200 group-hover:scale-110 group-hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.32)]"
      loading="lazy"
    />
    <span
      class="skillcard-label pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 translate-y-1 rounded-full border border-white/15 bg-black/50 px-2 py-0.5 text-[11px] font-medium text-white opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100"
      :class="{ '!translate-y-0 !opacity-100': active }"
    >{{ name }}</span>
  </article>
</template>
