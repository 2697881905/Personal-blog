<script setup lang="ts">
type SocialLink = {
  label: string;
  href: string;
};

defineProps<{
  name: string;
  socialLinks: SocialLink[];
}>();

const year = new Date().getFullYear();
</script>

<template>
  <footer class="liquid-footer border-t">
    <div class="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between sm:px-6">
      <p>Copyright {{ year }} {{ name }}. All rights reserved.</p>
      <nav class="flex flex-wrap gap-4">
        <a
          v-for="link in socialLinks"
          :key="link.href"
          :href="link.href"
          class="transition hover:text-accent hover:underline hover:underline-offset-4"
          target="_blank"
          rel="noreferrer"
        >
          {{ link.label }}
        </a>
      </nav>
    </div>
  </footer>
</template>
