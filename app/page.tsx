import { Button } from "@/components/ui/button"
import { AuthExample } from "@/components/AuthExample"
import { Sparkles, Code, Zap } from "lucide-react"

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8 md:p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between">
        <div className="flex flex-col items-center gap-8">
          <div className="flex items-center gap-2">
            <Sparkles className="h-8 w-8 text-primary" />
            <h1 className="text-4xl font-bold text-center">
              Welcome to DocQ Mint
            </h1>
            <Sparkles className="h-8 w-8 text-primary" />
          </div>
          <p className="text-center text-muted-foreground text-lg">
            Next.js project with TypeScript, Tailwind CSS, and Shadcn/ui
          </p>
          
          {/* Firebase Auth Example */}
          <div className="w-full max-w-md">
            <AuthExample />
          </div>
          
          <div className="flex gap-4 mt-4">
            <Button variant="default">
              <Code className="mr-2 h-4 w-4" />
              Get Started
            </Button>
            <Button variant="outline">
              <Zap className="mr-2 h-4 w-4" />
              Learn More
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}

