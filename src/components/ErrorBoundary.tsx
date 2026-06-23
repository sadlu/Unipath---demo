import { Component, type ReactNode, type ErrorInfo } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info.componentStack)
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback
      return (
        <div className="w-full flex flex-col items-center justify-center py-16 px-4 text-center">
          <span className="text-3xl mb-3">⚠️</span>
          <h2 className="text-lg font-bold text-white mb-1">Something went wrong</h2>
          <p className="text-sm text-slate-400 mb-4 max-w-md">
            {this.state.error?.message || 'An unexpected error occurred.'}
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="px-5 py-2 bg-[#7C5CFC] hover:bg-[#8D6CFF] rounded-xl text-white text-sm font-semibold transition-colors"
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
