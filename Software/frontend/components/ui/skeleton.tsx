import { cn } from '@/lib/utils'

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-lab-neutral-200', className)}
      {...props}
    />
  )
}

// Table row skeleton
function TableRowSkeleton({ columns = 5 }: { columns?: number }) {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: columns }).map((_, i) => (
        <td key={i} className="p-3">
          <div className="h-4 bg-lab-neutral-200 rounded w-full" />
        </td>
      ))}
    </tr>
  )
}

// Card skeleton for dashboard stats
function CardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-lab-neutral-200 p-6 animate-pulse">
      <div className="h-4 bg-lab-neutral-200 rounded w-1/3 mb-4" />
      <div className="h-8 bg-lab-neutral-200 rounded w-2/3 mb-2" />
      <div className="h-3 bg-lab-neutral-200 rounded w-1/2" />
    </div>
  )
}

// List item skeleton
function ListItemSkeleton() {
  return (
    <div className="flex items-center justify-between p-4 bg-lab-neutral-50 rounded-lg animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-lab-neutral-200 rounded-full" />
        <div className="space-y-2">
          <div className="h-4 bg-lab-neutral-200 rounded w-32" />
          <div className="h-3 bg-lab-neutral-200 rounded w-20" />
        </div>
      </div>
      <div className="h-6 bg-lab-neutral-200 rounded w-16" />
    </div>
  )
}

// Full page loading
function PageLoadingSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="space-y-2">
        <div className="h-8 bg-lab-neutral-200 rounded w-1/4" />
        <div className="h-4 bg-lab-neutral-200 rounded w-1/3" />
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-lab-neutral-200 overflow-hidden">
        <div className="p-4 border-b border-lab-neutral-200">
          <div className="h-6 bg-lab-neutral-200 rounded w-1/4" />
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-lab-neutral-100">
              {Array.from({ length: 5 }).map((_, i) => (
                <th key={i} className="p-3">
                  <div className="h-4 bg-lab-neutral-200 rounded w-full" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 5 }).map((_, i) => (
              <TableRowSkeleton key={i} columns={5} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// Inline loading spinner
function LoadingSpinner({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  }

  return (
    <svg
      className={`animate-spin text-lab-primary-600 ${sizeClasses[size]}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  )
}

// Empty state component
function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: React.ReactNode
  title: string
  description?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex flex-col items-center justify-center py-12 px-4">
      {icon && (
        <div className="w-16 h-16 rounded-full bg-lab-neutral-100 flex items-center justify-center mb-4 text-lab-neutral-400">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium text-lab-neutral-900">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-lab-neutral-500 text-center max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export {
  Skeleton,
  TableRowSkeleton,
  CardSkeleton,
  ListItemSkeleton,
  PageLoadingSkeleton,
  LoadingSpinner,
  EmptyState,
}
