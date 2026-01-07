'use client';

import { Button } from "@/components/ui/button";
import { GraduationCap, Building2, FileText, Shield, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  const teamMembers = [
    {
      name: "Dr. Randall D'Souza",
      role: "CEO",
      image: "/people/CEO-Randall.jpg",
      statement: "Dr. Randall D'Souza, Founder & CEO of UpGrades by DocQ-Mint, is building blockchain-powered student credentialing solutions. With a strong research background and global recognition, he is committed to making academic records secure, verifiable, and accessible for life."
    },
    {
      name: "Rohann",
      role: "CTO",
      image: "/people/CTO - Rohann.png",
      statement: "Blockchain-powered credentials: simple for schools to adopt, secure for students to own, and scalable for the future of education. As CTO, I focus on delivering tamper-proof, verifiable records through a Web2.5 approach—combining user-friendly design with enterprise-grade security, reliability, and global scalability."
    },
    {
      name: "Daniel",
      role: "CCO",
      image: "/people/CCO - Daniel.jpg",
      statement: "Driving growth through strategy, partnerships, and communication—delivering measurable value to schools, students, and stakeholders. As CCO, I focus on building long-term relationships, shaping go-to-market strategies, and ensuring that our solutions not only reach new institutions but also create lasting impact across the education landscape."
    },
    {
      name: "Eric",
      role: "Chief of Staff",
      image: "/people/Chief Of Staff - Eric.jpg",
      statement: "I'm passionate about harnessing blockchain to transform education with secure, verifiable academic records. With 28 years of experience in insurance and entrepreneurial leadership, I bring proven expertise in strategy, sales, and operations. I am committed to driving adoption, forging strong partnerships, and advancing a more transparent, learner-centered education system."
    },
    {
      name: "Monique",
      role: "Legal Advisor",
      image: "/people/Legal Advisor - Monique.jpg",
      statement: "Legal Advisor with over 10 years of experience in an international environment. Focused on drafting contracts, ensuring compliance, and aligning agreements with business goals. A reliable partner for clear and practical legal support."
    },
    {
      name: "Eric Tsai",
      role: "Senior Developer",
      image: "/people/Senior Developer - Eric.jpg",
      statement: "Full-Stack Engineer specializing in AI, Web3, and scalable apps. Cardano Ambassador and developer behind 20+ blockchain projects, including the largest Cardano NFT minting platform."
    },
    {
      name: "Nina Zeng, PhD",
      role: "Head of Communications",
      image: "/people/Head of Communications - Nina.jpg",
      statement: "Nina Zeng excels in design, storytelling, and brand communication, bringing clarity, creativity, and precision to every project while ensuring impactful, engaging, and memorable results."
    },
    {
      name: "Matt Stephens",
      role: "Design Lead",
      image: "/people/Design Lead - Matt.jpg",
      statement: "With a combined two decades experience in the Police and Defence Security Industry, Matt brings reliability and trust as Design Lead at DocQmint, shaping user experiences and brand identity with a secure, creative approach."
    }
  ];

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
              Blockchain-Powered Student Credentialing
            </p>
            <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto leading-relaxed">
              Making academic records secure, verifiable, and accessible for life. 
              We combine user-friendly design with enterprise-grade security for the future of education.
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
              Built for Schools and Students
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
              <h3 className="text-xl font-semibold">School Management</h3>
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
              <h3 className="text-xl font-semibold">Student Portal</h3>
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
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Meet Our Team
            </h2>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              A diverse group of experts committed to transforming education through blockchain technology
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
            {teamMembers.map((member, index) => (
              <div 
                key={index}
                className="group bg-card border rounded-xl overflow-hidden hover:shadow-xl transition-all duration-300"
              >
                <div className="relative h-80 bg-muted overflow-hidden">
                  <Image
                    src={member.image}
                    alt={member.name}
                    fill
                    className="object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                </div>
                <div className="p-6 space-y-3">
                  <div>
                    <h3 className="text-xl font-bold">{member.name}</h3>
                    <p className="text-primary font-semibold">{member.role}</p>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-6">
                    {member.statement}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-8 bg-gradient-to-t from-muted/50 to-background">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <h2 className="text-4xl md:text-5xl font-bold">Ready to Transform Education?</h2>
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
        <div className="max-w-7xl mx-auto text-center text-muted-foreground">
          <p>&copy; 2026 UpGrades by DocQ-Mint. All rights reserved.</p>
        </div>
      </footer>
    </main>
  );
}

