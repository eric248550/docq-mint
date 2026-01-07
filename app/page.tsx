'use client';

import { Button } from "@/components/ui/button";
import { GraduationCap, Building2, FileText, Shield, ArrowRight } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col">
      {/* Hero Section */}
      <section className="relative flex flex-col items-center justify-center p-8 md:p-24 min-h-[90vh] bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-6xl w-full text-center space-y-8">
          <div className="space-y-6">
            <h1 className="text-6xl md:text-7xl lg:text-8xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              UpGrades by DocQ-Mint
            </h1>
            <p className="text-2xl md:text-3xl font-semibold text-foreground">
            Blockchain Powered Record Issuance and Verification
            </p>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Making records secure, verifiable, and accessible for life. 
              We combine user-friendly design with enterprise-grade security.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link href="/dashboard">
              <Button size="lg" className="text-lg px-8 py-6">
                Get Started <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/identity">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Sign In
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-8 bg-muted/50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Built for issuers, holders and verifiers
            </h2>
            <p className="text-xl text-muted-foreground">
              Secure, scalable, and simple to use
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            <div className="bg-background border rounded-xl p-8 space-y-4 hover:shadow-lg transition-shadow">
              <div className="p-4 bg-primary/10 rounded-lg w-fit">
                <Building2 className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Admin Management</h3>
              <p className="text-muted-foreground leading-relaxed">
                Create and manage schools, invite students, and organize documents efficiently with our intuitive platform.
              </p>
            </div>

            <div className="bg-background border rounded-xl p-8 space-y-4 hover:shadow-lg transition-shadow">
              <div className="p-4 bg-primary/10 rounded-lg w-fit">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Secure Documents</h3>
              <p className="text-muted-foreground leading-relaxed">
                Tamper-proof, blockchain-verified academic records with enterprise-grade security and reliability.
              </p>
            </div>

            <div className="bg-background border rounded-xl p-8 space-y-4 hover:shadow-lg transition-shadow">
              <div className="p-4 bg-primary/10 rounded-lg w-fit">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Holder Portal</h3>
              <p className="text-muted-foreground leading-relaxed">
                Students can access, view, and share their verified credentials anytime, anywhere, for life.
              </p>
            </div>

            <div className="bg-background border rounded-xl p-8 space-y-4 hover:shadow-lg transition-shadow">
              <div className="p-4 bg-primary/10 rounded-lg w-fit">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-xl font-semibold">Blockchain Verified</h3>
              <p className="text-muted-foreground leading-relaxed">
                Web2.5 approach combining user-friendly design with blockchain security and global scalability.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 px-8 bg-background">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold">Meet Our Team</h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            A diverse group of experts committed to transforming education through blockchain technology
          </p>
          <Link href="/team">
            <Button size="lg" variant="outline" className="text-lg px-8 py-6">
              View Our Team <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-8 bg-gradient-to-t from-muted/50 to-background">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold">Ready to Transform  Record Creation?</h2>
          <p className="text-xl text-muted-foreground leading-relaxed">
            Join us in building the future of secure, verifiable academic credentials. 
            Whether you&apos;re a school administrator or a student, we&apos;re here to help.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4">
            <Link href="/schools/create">
              <Button size="lg" className="text-lg px-8 py-6">
                Create Your School <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
            <Link href="/identity">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6">
                Access Your Documents
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 px-8 border-t bg-muted/30">
        <div className="max-w-7xl mx-auto">
          <div className="mb-6">
            <h3 className="text-lg font-semibold mb-4 text-center">Contact Us</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center text-sm">
              <div>
                <p className="font-medium">Randall</p>
                <a href="mailto:R.dsouza@auckland.ac.nz" className="text-primary hover:underline">
                  R.dsouza@auckland.ac.nz
                </a>
              </div>
              <div>
                <p className="font-medium">Rohann</p>
                <a href="mailto:Rohann.dsouza@docq-mint.com" className="text-primary hover:underline">
                  Rohann.dsouza@docq-mint.com
                </a>
              </div>
              <div>
                <p className="font-medium">Daniel</p>
                <a href="mailto:Daniel.sullivan@docq-mint.com" className="text-primary hover:underline">
                  Daniel.sullivan@docq-mint.com
                </a>
              </div>
              <div>
                <p className="font-medium">Eric</p>
                <a href="mailto:eric.tsai@docq-mint.com" className="text-primary hover:underline">
                  eric.tsai@docq-mint.com
                </a>
              </div>
            </div>
          </div>
          <div className="text-center text-muted-foreground border-t pt-6">
            <p>&copy; 2026 UpGrades by DocQ-Mint. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </main>
  );
}

