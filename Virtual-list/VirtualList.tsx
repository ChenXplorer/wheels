import { throttle } from 'loadash'
import { ExtractPropTypes, onMounted, nextTick, onBeforeUpdate, reactive, watch, onUnmounted ,defineComponent, ref, computed, h, Ref} from 'vue'
import VirtualListItem from './VirtualListItem'

const component = 'virtual-list'
const cssPrefix = `${component}`
const virtualListProps = {
  dynamic: {
    type: Boolean,
    default: false,
  },
  list: {
    type: Array,
    default: () => [],
  },
  pageMode: {
    type: Boolean,
    default: false,
  },
  classContentName: {
    type: String,
    default: '',
  },
  defaultItemHeight: {
    type: Number,
    default: 30, // 建议预估高度较小
  },
  bottomThreshold: {
    type: Number,
    default: 1, // 触底的高度
  },
  multiCol: {
    type: Number,
    default: 0,
  },
  gap: {
    type: Number,
    default: 0,
  },
  bufferSize: {
    type: Number,
    default: 3,
  },
} as const

export type VirtualListProps = Partial<ExtractPropTypes<typeof virtualListProps>>
export type cachedListPosition = {
  height: number
  scrollY: number
}
export type FirstInsightItemInfo = {
  offset: number
  index: number
}

// 1. 获取元素动态高度 resize observer
// 2. 模拟可滚动高度

export default defineComponent({
  name: 'VVirtualList',
  inheritAttrs: false,
  props: virtualListProps,
  emits: ['multiInit', 'toBottom'],
  setup(props, { slots, attrs, emit }) {
    const itemRefList: any = ref([])
    const latestScrollTop = ref(0)
    const isFixScroll = ref(false)
    const itemMountedTriggered = ref(false)
    const firstInsightItem = reactive<FirstInsightItemInfo>({
      offset: 0, // 相对于可视区域的偏移量
      index: 0,
    })
    const cachedListHeights = ref<Array<number>>([])
    const cachedListScrollY = ref<Array<number>>([])
    const container = ref() as Ref<HTMLElement>
    const visibleListSize = ref(0)
    const startListIndex = ref(0)
    const endListIndex = ref(0)
    const multiItemSize = ref(0)
    const multiScrollY = ref(0)

    const setItemRef = (el: any) => {
      if (el) {
        itemRefList.value.push(el)
      }
    }

    onBeforeUpdate(() => {
      itemRefList.value = []
    })

    onMounted(() => {
      if (props.multiCol) {
        multiModeMounted()
      }
      if (props.pageMode) {
        pageModeMounted()
      }
      if (!props.dynamic) {
        calcFixedHeightItemPosition()
      }
      visibleListSize.value = getVisibleListSize()
    })

    onUnmounted(() => {
      if (props.pageMode) {
        pageModeUnmounted()
      }
    })

    const multiModeMounted = () => {
      multiItemSize.value = getDomHeight(itemRefList.value?.[0])
      for (let i = 0; i < props.list.length; i++) {
        cachedListHeights.value[i] = multiItemSize.value
      }
      emit('multiInit')
    }

    const pageModeMounted = () => {
      document.addEventListener('scroll', handleScroll, {
        passive: false,
      })
    }
    const pageModeUnmounted = () => {
      document.removeEventListener('scroll', handleScroll)
    }

    const formatList = computed(() =>
      props.list.map((val, i) => ({
        data: val,
        index: i,
      }))
    )

    const totalHeight = computed(() => {
      if (props.multiCol) {
        return multiItemSize.value * Math.ceil(props.list.length / props.multiCol)
      }
      if (cachedListScrollY.value[props.list.length - 1]) {
        const height = cachedListScrollY.value[props.list.length - 1] + cachedListHeights.value[props.list.length - 1]
        return height
      }
      const totalCachedHeight = cachedListHeights.value.reduce((pre, cur) => pre + cur, 0)
      return totalCachedHeight + (props.list.length - cachedListHeights.value.length) * props.defaultItemHeight
    })

    watch(
      () => props.multiCol,
      (newV, oldV) => {
        multiInit(newV, oldV)
      }
    )

    watch([() => props.list, props.list], () => {
      if (!props.dynamic) {
        calcFixedHeightItemPosition()
      }
    })

    const resizeChange = throttle(() => {
      if (props.dynamic) {
        calcItemPosition()
      }
      if (props.multiCol) {
        multiInit()
      }
    }, 600)

    const getDomHeight = (dom: any) => {
      if (!dom) return props.defaultItemHeight
      const el = dom?.$el || dom
      return (el.getBoundingClientRect().height + props.gap) as number
    }

    const getTopSize = () => {
      if (props.pageMode) {
        const top = container.value.getBoundingClientRect().top
        return top > 0 ? 0 : -top
      }
      return container.value?.scrollTop || 0
    }

    const getSize = (type: 'clientHeight' | 'scrollHeight' | 'scrollTop') => {
      let result
      if (props.pageMode) {
        result = (document.documentElement || document.body)?.[type] || 0
      } else {
        result = container.value?.[type] || 0
      }
      return Math.ceil(result)
    }

    const setScrollTop = (value: number) => {
      if (props.pageMode) {
        document.body.scrollTop = value + getScrollFront()
        document.documentElement.scrollTop = value + getScrollFront()
      } else {
        container.value.scrollTop = value
      }
    }

    const getScrollFront = () => {
      if (props.pageMode) {
        const scrollTop = document.documentElement.scrollTop || document.body.scrollTop
        const top = container.value.getBoundingClientRect().top
        return scrollTop + top
      }
      return 0
    }

    const getVisibleListSize = () => {
      const clientHeight = getSize('clientHeight')
      const domHeight = props.multiCol ? getDomHeight(itemRefList.value?.[0]) : props.defaultItemHeight
      return Math.ceil(clientHeight / domHeight)
    }

    const multiInit = (newV = 0, oldV = 0) => {
      const elHeight = getDomHeight(itemRefList.value?.[0])
      let diff: number
      if (newV !== oldV) {
        const totalNum = Math.max(0, (firstInsightItem.index - 1) * oldV)
        const newCols = Math.floor(totalNum / newV)
        diff = newCols * elHeight - (firstInsightItem.index - 1) * multiItemSize.value
      } else {
        if (elHeight === multiItemSize.value) return
        diff = (firstInsightItem.index - 1) * (elHeight - multiItemSize.value)
      }
      const scroll = latestScrollTop.value + diff
      nextTick(() => {
        setScrollTop(scroll)
        multiItemSize.value = elHeight
      })
    }

    const calcFixedHeightItemPosition = () => {
      const height = getDomHeight(itemRefList.value?.[0])
      for (let i = 0; i < props.list.length; i++) {
        cachedListHeights.value[i] = height
        cachedListScrollY.value[i] = i === 0 ? 0 : cachedListScrollY.value[i - 1] + height
      }
    }

    const getFirstInsightItem = (diff: number, oldOffset: number, oldIndex: number) => {
      // 以锚点元素为基点，向上和向下更新每个item
      const len = props.multiCol ? Math.ceil(props.list.length / props.multiCol) : props.list.length
      let offset = diff + oldOffset
      let newIndex = oldIndex
      if (offset >= 0) {
        while (newIndex < len && offset > (cachedListHeights.value?.[newIndex] || props.defaultItemHeight)) {
          if (!cachedListHeights.value?.[newIndex]) {
            cachedListHeights.value[newIndex] = props.defaultItemHeight
          }
          offset -= cachedListHeights.value[newIndex]
          newIndex++
        }
        if (newIndex >= len) {
          newIndex = len - 1
          offset = 0
        }
      } else {
        while (offset < 0) {
          if (!cachedListHeights.value?.[newIndex - 1]) {
            cachedListHeights.value[newIndex - 1] = props.defaultItemHeight
          }
          offset += cachedListHeights.value[newIndex - 1]
          newIndex--
        }
        if (newIndex < 0) {
          newIndex = 0
          offset = 0
        }
      }
      firstInsightItem.index = newIndex
      firstInsightItem.offset = offset
    }

    const calcItemPosition = async () => {
      await nextTick()
      itemRefList.value.sort((a: any, b: any) => a.index - b.index)
      const flagIndex = itemRefList.value.findIndex((v: { index: number }) => v?.index === firstInsightItem.index)
      if (flagIndex === -1) return
      cachedListHeights.value[firstInsightItem.index] = getDomHeight(itemRefList.value[flagIndex])
      cachedListScrollY.value[firstInsightItem.index] = latestScrollTop.value - firstInsightItem.offset
      for (let i = flagIndex + 1; i < itemRefList.value.length; i++) {
        const preH = cachedListHeights.value[itemRefList.value[i]?.index - 1]
        const preY = cachedListScrollY.value[itemRefList.value[i]?.index - 1]
        cachedListHeights.value[itemRefList.value[i].index] = getDomHeight(itemRefList.value[i])
        cachedListScrollY.value[itemRefList.value[i].index] = preH + preY
      }
      for (let i = flagIndex - 1; i >= 0; i--) {
        const height = getDomHeight(itemRefList.value[i])
        const preY = cachedListScrollY.value[itemRefList.value[i]?.index + 1]
        cachedListHeights.value[itemRefList.value[i].index] = height
        cachedListScrollY.value[itemRefList.value[i].index] = preY - height
      }
      if (cachedListScrollY.value[itemRefList.value[0].index] <= -1) {
        fixScrollToTopLessSpace()
      }
    }

    // 修复快速滑动到顶部滚动条多的偏差 not need  预估高度尽可能设置的小
    // 修复快速滑动到顶部滚动条不足的偏差
    const fixScrollToTopLessSpace = () => {
      isFixScroll.value = true
      const ignoredHeight = cachedListHeights.value.slice(0, firstInsightItem.index).reduce((pre, cur) => pre + cur, 0)
      latestScrollTop.value = ignoredHeight + firstInsightItem.offset
      setScrollTop(latestScrollTop.value)
      if (latestScrollTop.value === 0) {
        firstInsightItem.index = 0
        firstInsightItem.offset = 0
      }
      calcItemPosition()
      isFixScroll.value = false
    }

    const getListIndexRange = () => {
      const keeps = visibleListSize.value + props.bufferSize * 2
      let start = Math.max(0, firstInsightItem.index - props.bufferSize)
      const end = Math.min(keeps + start, formatList.value.length)
      if (end === formatList.value.length) {
        start = Math.max(0, end - keeps)
      }
      setListRange(start, end)
      return [start, end]
    }

    const getMultiListIndexRange = () => {
      const keeps = (visibleListSize.value + props.bufferSize * 2) * props.multiCol
      let startCol = Math.max(0, firstInsightItem.index - props.bufferSize)
      let start = startCol * props.multiCol
      const end = Math.min(formatList.value.length, start + keeps)
      if (end === formatList.value.length) {
        start = Math.max(0, end - keeps)
      }
      startCol = Math.floor(start / props.multiCol)
      multiScrollY.value = startCol * multiItemSize.value
      setListRange(start, end)
      return [start, end]
    }

    const setListRange = (start: number, end: number) => {
      startListIndex.value = start
      endListIndex.value = end - 1
    }

    const getVisibleList = () => {
      const range = props.multiCol ? getMultiListIndexRange() : getListIndexRange()
      return formatList.value.slice(...range)
    }

    const judgeReachBottom = () => {
      const offset = getSize('scrollTop')
      const clientSize = getSize('clientHeight')
      const scrollSize = getSize('scrollHeight')
      if (offset + clientSize + props.bottomThreshold >= scrollSize) {
        emit('toBottom')
      }
    }

    const handleScroll = () => {
      if (isFixScroll.value) return
      const scrollTop = getTopSize()
      const diffScroll = scrollTop - latestScrollTop.value
      latestScrollTop.value = scrollTop
      getFirstInsightItem(diffScroll, firstInsightItem.offset, firstInsightItem.index)
      if (diffScroll > 0) {
        judgeReachBottom()
      }
    }

    const handleContainerScroll = () => {
      if (props.pageMode) return
      handleScroll()
    }

    const itemMountedTrigger = () => {
      if (props.multiCol && !itemMountedTriggered.value) {
        multiItemSize.value = getDomHeight(itemRefList.value?.[0])
      }
      itemMountedTriggered.value = true
    }

    return () => {
      const list = getVisibleList()
      const listDom = list.map((l) => (
        <VirtualListItem
          ref={setItemRef}
          index={l.index}
          key={l.index}
          onResizeChange={resizeChange}
          onMountedTrigger={itemMountedTrigger}
        >
          {() => slots.default?.({ item: l.data })}
        </VirtualListItem>
      ))

      const getContentStyle = {
        height: `${totalHeight.value}px`,
      }

      const contentListStyle = () => {
        const result: any = {}
        if (props.multiCol) {
          result.transform = `translate(0,${multiScrollY.value}px)`
        } else {
          result.transform = `translate(0,${cachedListScrollY.value[startListIndex.value] || 0}px)`
        }
        return result
      }

      return (
        <div
          class={cssPrefix}
          style={!props.pageMode ? { overflow: 'auto' } : {}}
          ref={container}
          onScroll={handleContainerScroll}
        >
          <div class={`${cssPrefix}-content`} style={getContentStyle}>
            <div class={[props.classContentName]} style={contentListStyle()}>
              {listDom}
              {slots.contentFooter?.()}
            </div>
          </div>
          {slots.footer?.()}
        </div>
      )
    }
  },
})
