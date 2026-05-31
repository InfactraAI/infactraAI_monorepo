export const verticalHoverPlugin = {
  id: 'verticalHover',
  beforeDraw(chart: any) {
    const tooltip = chart.tooltip;

    if (tooltip && tooltip._active && tooltip._active.length) {
      const ctx = chart.ctx;
      const activePoints = tooltip._active;

      // First and last bar of the group
      const first = activePoints[0].element;
      const last = activePoints[activePoints.length - 1].element;

      const leftX = first.x - first.width / 2;
      const rightX = last.x + last.width / 2;

      const topY = chart.scales.y.top;
      const bottomY = chart.scales.y.bottom;

      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.08)';
      ctx.fillRect(leftX, topY, rightX - leftX, bottomY - topY);
      ctx.restore();
    }
  }
};
