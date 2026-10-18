import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button, EmptyState } from '../design/ui';

interface Props {
  children: ReactNode;
  /** Changing this value clears a previous error (for example when the route changes). */
  resetKey?: string;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('NEXUS module crashed:', error, info.componentStack);
  }

  componentDidUpdate(prev: Props): void {
    if (this.state.error && prev.resetKey !== this.props.resetKey) {
      this.setState({ error: null });
    }
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <EmptyState
          title="Something went wrong in this section"
          action={<Button onClick={() => this.setState({ error: null })}>Try again</Button>}
        >
          {this.state.error.message || 'An unexpected error occurred.'} The rest of NEXUS is still working.
        </EmptyState>
      );
    }
    return this.props.children;
  }
}
