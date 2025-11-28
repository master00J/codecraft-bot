import { Link } from '@/navigation'
import { Button } from "@/components/ui/button"
import { ArrowLeft } from "lucide-react"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"

export default function TermsPage() {
  return (
    <div>
      <Navbar />
      <main className="min-h-screen px-6 py-24">
        <div className="mx-auto max-w-4xl">
          <Link href="/">
            <Button variant="ghost" className="gap-2 mb-8">
              <ArrowLeft className="h-4 w-4" />
              Back to Home
            </Button>
          </Link>

          <h1 className="text-4xl font-bold mb-8">Terms of Service</h1>
          
          <div className="prose prose-lg dark:prose-invert max-w-none">
            <p className="text-muted-foreground mb-6">
              Last updated: {new Date().toLocaleDateString()}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">1. Acceptance of Terms</h2>
              <p>
                By accessing and using CodeCraft Solutions services, you accept and agree to be bound by the terms and provision of this agreement.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">2. Services</h2>
              <p>
                CodeCraft Solutions provides web development, Discord bot development, and related digital services. We reserve the right to modify or discontinue services at any time.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">3. Payment Terms</h2>
              <ul className="list-disc pl-6 space-y-2">
                <li>50% upfront payment for projects under $2,000</li>
                <li>Milestone-based payments for larger projects</li>
                <li>Payment plans are available upon request</li>
                <li>All payments are processed securely</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">4. Refund Policy</h2>
              <p>
                Refunds are handled on a case-by-case basis. Please contact us if you have concerns about your project.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">5. Intellectual Property</h2>
              <p>
                Upon full payment, you receive full ownership of the delivered product. We retain the right to showcase the work in our portfolio unless otherwise agreed.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">6. Privacy</h2>
              <p>
                We respect your privacy. Information collected through Discord OAuth is used solely for account management and service delivery.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">7. Limitation of Liability</h2>
              <p>
                CodeCraft Solutions shall not be liable for any indirect, incidental, special, consequential or punitive damages resulting from your use of our services.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold mb-4">8. Contact</h2>
              <p>
                For questions about these terms, please contact us through our Discord server or contact page.
              </p>
            </section>
          </div>

          <div className="mt-12 p-6 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">
              These terms are subject to change. Continued use of our services constitutes acceptance of any modifications.
            </p>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

