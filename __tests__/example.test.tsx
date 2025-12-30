import { render, screen } from '@testing-library/react'
import { Button } from '@/components/ui/button'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
  }),
  usePathname: () => '/',
}))

// Mock Firebase
jest.mock('@/lib/firebase/config', () => ({
  auth: null,
  default: null,
}))

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>)
    const button = screen.getByText(/Click me/i)
    expect(button).toBeInTheDocument()
  })

  it('renders button with default variant', () => {
    render(<Button variant="default">Default Button</Button>)
    const button = screen.getByText(/Default Button/i)
    expect(button).toHaveClass('bg-primary')
  })

  it('renders button with outline variant', () => {
    render(<Button variant="outline">Outline Button</Button>)
    const button = screen.getByText(/Outline Button/i)
    expect(button).toHaveClass('border')
  })

  it('can be disabled', () => {
    render(<Button disabled>Disabled</Button>)
    const button = screen.getByText(/Disabled/i)
    expect(button).toBeDisabled()
  })
})

