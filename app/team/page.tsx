'use client';

import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function TeamPage() {
  const teamMembers = [
    {
      name: "Dr. Randall D'Souza",
      role: "CEO",
      image: "/people/CEO-Randall.jpg",
      statement: "Dr. Randall D'Souza, Founder & CEO of UpGrades by DocQ-Mint, is building blockchain-powered student credentialing solutions. With a strong research background and global recognition, he is committed to making academic records secure, verifiable, and accessible for life."
    },
    {
      name: "Dr. Rohann D'Souza",
      role: "CTO",
      image: "/people/CTO - Rohann.png",
      statement: "Blockchain-powered credentials: simple for schools to adopt, secure for students to own, and scalable for the future of education. As CTO, I focus on delivering tamper-proof, verifiable records through a Web2.5 approach—combining user-friendly design with enterprise-grade security, reliability, and global scalability."
    },
    {
      name: "Daniel Sullivan",
      role: "CCO",
      image: "/people/CCO - Daniel.jpg",
      statement: "Driving growth through strategy, partnerships, and communication—delivering measurable value to schools, students, and stakeholders. As CCO, I focus on building long-term relationships, shaping go-to-market strategies, and ensuring that our solutions not only reach new institutions but also create lasting impact across the education landscape."
    },
    {
      name: "Eric Plourde Sr.",
      role: "Chief of Staff",
      image: "/people/Chief Of Staff - Eric.jpg",
      statement: "I'm passionate about harnessing blockchain to transform education with secure, verifiable academic records. With 28 years of experience in insurance and entrepreneurial leadership, I bring proven expertise in strategy, sales, and operations. I am committed to driving adoption, forging strong partnerships, and advancing a more transparent, learner-centered education system."
    },
    {
      name: "Monique Bercx",
      role: "Legal Advisor",
      image: "/people/Legal Advisor - Monique.jpg",
      statement: "Legal Advisor with over 10 years of experience in an international environment. Focused on drafting contracts, ensuring compliance, and aligning agreements with business goals. A reliable partner for clear and practical legal support."
    },
    {
      name: "Eric Tsai",
      role: "Senior Developer",
      image: "/people/Senior Developer - Eric.jpg",
      statement: "Full-Stack Engineer specializing in AI, Web3, and scalable apps. Blockchain Ambassador and developer behind 20+ blockchain projects"
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
      {/* Header */}
      <section className="relative flex flex-col items-center justify-center p-8 md:p-16 bg-gradient-to-b from-background to-muted/30">
        <div className="max-w-7xl w-full">
          <Link href="/">
            <Button variant="ghost" className="mb-8">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Home
            </Button>
          </Link>
          
          <div className="text-center space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
              Meet Our Team
            </h1>
            <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
              A diverse group of experts committed to transforming education through blockchain technology
            </p>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 px-8 bg-background">
        <div className="max-w-7xl mx-auto">
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
                    className="object-cover object-top group-hover:scale-105 transition-transform duration-300"
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

