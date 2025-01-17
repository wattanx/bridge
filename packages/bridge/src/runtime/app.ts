import type { DefineComponent } from 'vue'
import { useHead } from '@unhead/vue'
import type { NuxtAppCompat } from '@nuxt/bridge-schema'
import { defineComponent, getCurrentInstance } from './composables'

export const isVue2 = true
export const isVue3 = false

export const defineNuxtComponent: typeof defineComponent =
function defineNuxtComponent (...args: any[]): any {
  const [options, key] = args
  const { setup, head, ...opts } = options

  // Avoid wrapping if no options api is used
  if (!setup && !options.asyncData && !options.head) {
    return {
      ...options
    }
  }

  return {
    _fetchKeyBase: key,
    ...opts,
    setup (props, ctx) {
      const nuxtApp = useNuxtApp()
      const res = setup ? callWithNuxt(nuxtApp, setup, [props, ctx]) : {}

      if (options.head) {
        const nuxtApp = useNuxtApp()
        useHead(typeof options.head === 'function' ? () => options.head(nuxtApp) : options.head)
      }

      return res
    }
  } as DefineComponent
}

export interface Context {
  $_nuxtApp: NuxtAppCompat
}

let currentNuxtAppInstance: NuxtAppCompat | null

export const setNuxtAppInstance = (nuxt: NuxtAppCompat | null) => {
  currentNuxtAppInstance = nuxt
}

/**
 * Ensures that the setup function passed in has access to the Nuxt instance via `useNuxt`.
 * @param nuxt A Nuxt instance
 * @param setup The function to call
 */
export function callWithNuxt<T extends (...args: any[]) => any> (nuxt: NuxtAppCompat, setup: T, args?: Parameters<T>) {
  setNuxtAppInstance(nuxt)
  const p: ReturnType<T> = args ? setup(...args as Parameters<T>) : setup()
  if (process.server) {
    // Unset nuxt instance to prevent context-sharing in server-side
    setNuxtAppInstance(null)
  }
  return p
}

interface Plugin {
  (nuxt: NuxtAppCompat): Promise<void> | Promise<{ provide?: Record<string, any> }> | void | { provide?: Record<string, any> }
}

export function defineNuxtPlugin (plugin: Plugin): (ctx: Context, inject: (id: string, value: any) => void) => void {
  return async (ctx, inject) => {
    const result = await callWithNuxt(ctx.$_nuxtApp, plugin, [ctx.$_nuxtApp])
    if (result && result.provide) {
      for (const key in result.provide) {
        inject(key, result.provide[key])
      }
    }
    return result
  }
}

export const useNuxtApp = (): NuxtAppCompat => {
  const vm = getCurrentInstance()

  if (!vm) {
    if (!currentNuxtAppInstance) {
      throw new Error('nuxt app instance unavailable')
    }
    return currentNuxtAppInstance
  }

  return vm.proxy.$_nuxtApp
}
