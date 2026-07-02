/**
 * StockBadge component — displays a colored pill badge for a product's stock status.
 * Requirement 3.9: zero = black, critical = red, warning = yellow, healthy = green.
 */

export type StockStatus = 'zero' | 'critical' | 'warning' | 'healthy'

interface StockBadgeProps {
  status: StockStatus
}

const badgeConfig: Record<StockStatus, { label: string; className: string }> = {
  zero: {
    label: 'Out of Stock',
    className: 'bg-gray-900 text-white',
  },
  critical: {
    label: 'Critical',
    className: 'bg-red-600 text-white',
  },
  warning: {
    label: 'Low',
    className: 'bg-amber-400 text-amber-900',
  },
  healthy: {
    label: 'In Stock',
    className: 'bg-green-500 text-white',
  },
}

export function StockBadge({ status }: StockBadgeProps) {
  const { label, className } = badgeConfig[status]

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${className}`}
    >
      {label}
    </span>
  )
}

export default StockBadge
