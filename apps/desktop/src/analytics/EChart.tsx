import { useEffect, useRef } from "react";
import * as echarts from "echarts/core";
import { BarChart, LineChart } from "echarts/charts";
import {
  GridComponent,
  TooltipComponent,
  type GridComponentOption,
  type TooltipComponentOption,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import type { BarSeriesOption, LineSeriesOption } from "echarts/charts";
import type { ComposeOption } from "echarts/core";

echarts.use([LineChart, BarChart, GridComponent, TooltipComponent, CanvasRenderer]);

export type OSChartOption = ComposeOption<
  | LineSeriesOption
  | BarSeriesOption
  | GridComponentOption
  | TooltipComponentOption
>;

type EChartProps = {
  option: OSChartOption;
  className?: string;
};

export default function EChart({ option, className = "" }: EChartProps) {
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const chart = echarts.init(host, undefined, { renderer: "canvas" });
    chart.setOption(option, { notMerge: true, lazyUpdate: true });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(host);

    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, []);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    const chart = echarts.getInstanceByDom(host);
    chart?.setOption(option, { notMerge: true, lazyUpdate: true });
  }, [option]);

  return <div ref={hostRef} className={`os-chart ${className}`.trim()} />;
}
