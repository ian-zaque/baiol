import { createContext, createElement, ReactNode, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

export const SIDEBAR_WIDTH = 300;

const SidebarContext = createContext(0);

export function SidebarProvider({ width, children }: { width: number; children: ReactNode }) {
  return createElement(SidebarContext.Provider, { value: width }, children);
}

export function useLayout() {
  const { width, height } = useWindowDimensions();
  const sidebar = useContext(SidebarContext);
  const wide = width >= 960;
  const compact = width < 720;
  const pad = width < 480 ? 16 : 28;
  const chrome = sidebar > 0 ? 8 : 0;
  const available = Math.max(280, width - sidebar - chrome);
  const column = Math.min(available, 1120);
  const content = column - pad * 2;
  const columns = content >= 860 ? 3 : content >= 520 ? 2 : 1;

  return { width, height, wide, compact, pad, sidebar, content, columns };
}
