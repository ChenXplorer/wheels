import { ExtractPropTypes,defineComponent, ref, onMounted, onBeforeUnmount, StyleValue } from 'vue'
import { ResizeObserver } from '@juggle/resize-observer'

const component = 'virtual-list-item'
const cssPrefix = `${component}`
const virtualListItemProps = {
  index: Number,
  scrollY: Number,
} as const

export type virtualListItemProps = Partial<ExtractPropTypes<typeof virtualListItemProps>>

export default defineComponent({
  name: 'VVirtualListItem',
  inheritAttrs: false,
  props: virtualListItemProps,
  emits: ['resizeChange', 'mountedTrigger'],
  setup(props, { slots, attrs, emit }) {
    const virtualItem = ref()
    const ro = new ResizeObserver(() => {
      emit('resizeChange')
    })
    onMounted(() => {
      ro.observe(virtualItem.value)
      emit('mountedTrigger')
    })
    onBeforeUnmount(() => {
      ro.disconnect()
    })

    return () => {
      return (
        <div class={cssPrefix} ref={virtualItem} id={props.index + ''}>
          {slots.default?.()}
        </div>
      )
    }
  },
})
