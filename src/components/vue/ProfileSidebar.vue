<script setup lang="ts">
import { computed, ref } from 'vue';

type SocialLink = {
  label: string;
  href: string;
};

type Profile = {
  name: string;
  title: string;
  avatar: string;
  bio?: string;
  location?: string;
  tags?: string[];
  socialLinks: SocialLink[];
};

const props = defineProps<{
  profile: Profile;
}>();

const avatarFailed = ref(false);
const initials = computed(() => props.profile.name.slice(0, 2).toUpperCase());
</script>

<template>
  <aside class="w-[220px] space-y-4 lg:mx-auto">
    <section class="flex justify-start lg:justify-center">
      <div class="liquid-avatar relative h-[183px] w-[183px] overflow-hidden rounded-full">
        <img
          v-if="!avatarFailed"
          :src="profile.avatar"
          :alt="`${profile.name} avatar`"
          class="h-full w-full object-cover"
          @error="avatarFailed = true"
        />
        <div v-else class="flex h-full w-full items-center justify-center rounded-full bg-[#161b22]/70 text-5xl font-bold text-accent backdrop-blur-xl">
          {{ initials }}
        </div>
      </div>
    </section>

    <div class="hidden items-center gap-2 lg:block">
        <svg
          class="h-5 w-5 shrink-0 text-accent"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
          aria-hidden="true"
        >
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span class="text-base font-semibold text-text">Xi'an, China</span>
    </div>

  </aside>
</template>
