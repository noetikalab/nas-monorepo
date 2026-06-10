declare module "react-file-icon" {
  import type { FC, SVGProps } from "react";

  interface FileIconProps extends SVGProps<SVGSVGElement> {
    /** 文件扩展名（无点号前缀），如 "pdf"、"jpg" */
    extension?: string;
    /** 图标颜色（十六进制） */
    color?: string;
    /** 标签颜色（十六进制） */
    labelColor?: string;
    /** 标签文字颜色（十六进制） */
    labelTextColor?: string;
    /** 是否使用渐变 */
    gradient?: boolean;
    /** 图标半径（圆角） */
    radius?: number;
    /** 折角是否透明 */
    fold?: boolean;
    /** 替代 glyph（React 组件） */
    glyphColor?: string;
    /** 替代 label（React 组件） */
    type?: string;
  }

  export const FileIcon: FC<FileIconProps>;

  /** 按扩展名预设的图标样式（颜色、标签颜色等） */
  export const defaultStyles: Record<string, Partial<FileIconProps>>;
}
