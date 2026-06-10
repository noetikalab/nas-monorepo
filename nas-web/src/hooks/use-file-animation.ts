"use client";

/**
 * useFileAnimation — 文件列表 GSAP 动画 Hook
 *
 * 提供两种动画效果，供 FileList 和 FileGrid 组件使用：
 *   1. staggerIn：文件列表加载/切换目录时，条目依次淡入（stagger）
 *   2. viewSwitch：列表↔网格切换时，旧视图淡出 → 新视图淡入
 *
 * 遵循 GSAP React 最佳实践：
 *   - 使用 useRef 持有 DOM 引用
 *   - 使用 useCallback 创建可复用的动画触发函数
 *   - 使用 gsap.context() 管理动画生命周期（清理）
 *
 * 使用方式（在 FileList 中）：
 *   const { containerRef, animateStagger } = useFileAnimation();
 *   useEffect(() => { animateStagger(); }, [files]);
 *   return <div ref={containerRef}>...</div>;
 */

import { useRef, useCallback } from "react";
import gsap from "gsap";

interface UseFileAnimationReturn {
  /** 挂载到容器 DOM 上的 ref（FileList 或 FileGrid 的根 div） */
  containerRef: React.RefObject<HTMLDivElement | null>;
  /**
   * 触发文件条目依次淡入动画。
   * 选择器 ".file-row" 或 ".file-card" 由调用方在子元素上设置 class。
   *
   * @param childSelector 子元素选择器，如 ".file-row" / ".file-card"
   */
  animateStagger: (childSelector: string) => void;
  /**
   * 视图切换动画：先淡出当前视图，再触发回调（切换状态），再淡入新视图。
   *
   * @param childSelector 新视图的子元素选择器
   * @param onSwitch 切换状态的回调（在淡出完成后、淡入前执行）
   */
  animateViewSwitch: (childSelector: string, onSwitch: () => void) => void;
}

export function useFileAnimation(): UseFileAnimationReturn {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const ctxRef = useRef<gsap.Context | null>(null);

  /** 文件条目依次淡入 + 上移 */
  const animateStagger = useCallback((childSelector: string) => {
    const container = containerRef.current;
    if (!container) return;

    // 清理上一次的动画上下文
    ctxRef.current?.revert();
    ctxRef.current = gsap.context(() => {
      gsap.fromTo(
        childSelector,
        { opacity: 0, y: 12 },          // 起始：透明 + 向下偏移 12px
        {
          opacity: 1,
          y: 0,
          duration: 0.35,
          stagger: 0.03,                // 每个条目延迟 30ms
          ease: "power2.out",
        },
      );
    }, container);
  }, []);

  /** 视图切换：先淡出 → 切换状态 → 淡入新视图 */
  const animateViewSwitch = useCallback(
    (childSelector: string, onSwitch: () => void) => {
      const container = containerRef.current;
      if (!container) {
        onSwitch();
        return;
      }

      ctxRef.current?.revert();
      ctxRef.current = gsap.context(() => {
        // 第一步：淡出当前视图
        gsap.to(container.children, {
          opacity: 0,
          duration: 0.15,
          ease: "power2.in",
          onComplete: () => {
            // 第二步：切换状态（触发 React 重新渲染）
            onSwitch();

            // 第三步：下一帧淡入新视图
            requestAnimationFrame(() => {
              gsap.fromTo(
                childSelector,
                { opacity: 0, y: 8 },
                {
                  opacity: 1,
                  y: 0,
                  duration: 0.3,
                  stagger: 0.02,
                  ease: "power2.out",
                },
              );
            });
          },
        });
      }, container);
    },
    [],
  );

  return { containerRef, animateStagger, animateViewSwitch };
}
