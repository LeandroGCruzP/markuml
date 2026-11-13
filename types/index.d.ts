export type DiagramType = 'usecase';

export interface ThemeConfig {
  name?: 'light' | 'dark';
  background?: string;
  text?: string;
  mutedText?: string;
  titleText?: string;
  nodeFill?: string;
  nodeStroke?: string;
  edgeStroke?: string;
  fontFamily?: string;
  fontSize?: number;
  titleFontSize?: number;
  padding?: number;
}

export interface RenderOptions {
  theme?: 'light' | 'dark' | ThemeConfig;
}

export interface MarkdownRenderOptions extends RenderOptions {
  wrapperClass?: string;
}

export interface UseCaseActor {
  id: string;
  label: string;
}

export interface UseCaseNode {
  id: string;
  label: string;
}

export interface UseCaseRelation {
  from: string;
  to: string;
  kind: 'generalization' | 'association';
  dashed: boolean;
}

export interface UseCaseAST {
  type: 'usecase';
  title: string;
  actors: UseCaseActor[];
  useCases: UseCaseNode[];
  relations: UseCaseRelation[];
}

export type DiagramAST = UseCaseAST;

export interface RenderResult {
  svg: string;
  ast: DiagramAST;
  type: DiagramType;
}

export const THEMES: {
  light: Required<Omit<ThemeConfig, 'name'>>;
  dark: Required<Omit<ThemeConfig, 'name'>>;
};

export function resolveTheme(theme?: 'light' | 'dark' | ThemeConfig): Required<Omit<ThemeConfig, 'name'>>;
export function parseUML(source: string): DiagramAST;
export function renderAST(ast: DiagramAST, options?: RenderOptions): string;
export function renderSVG(source: string, options?: RenderOptions): string;
export function renderUML(source: string, options?: RenderOptions): RenderResult;
export function mountUML(target: HTMLElement | string, source: string, options?: RenderOptions): RenderResult;
export function renderMarkdownBlocks(markdown: string, options?: MarkdownRenderOptions): string;
