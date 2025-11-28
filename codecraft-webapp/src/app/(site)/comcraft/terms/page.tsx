"use client"

import { Link } from '@/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Shield, FileText, Clock, Mail } from "lucide-react"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"

export default function ComCraftTermsPage() {
  return (
    <div>
      <Navbar />
      <main className="min-h-screen px-6 py-24 bg-gradient-to-b from-background to-muted/20">
        <div className="mx-auto max-w-5xl">
          {/* Header */}
          <div className="mb-12">
            <Link href="/products/comcraft">
              <Button variant="ghost" className="gap-2 mb-6 hover:gap-3 transition-all">
                <ArrowLeft className="h-4 w-4" />
                Back to ComCraft
              </Button>
            </Link>

            <div className="flex items-center gap-3 mb-4">
              <div className="p-3 bg-primary/10 rounded-xl">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Terms of Service
                </h1>
                <p className="text-muted-foreground text-lg mt-2">ComCraft Discord Bot</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
              <Clock className="h-4 w-4" />
              Last updated: November 17, 2024
            </div>
          </div>

          {/* Quick Info Cards */}
          <div className="grid md:grid-cols-3 gap-4 mb-12">
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Effective Date</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">Nov 17, 2024</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Jurisdiction</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">Belgium</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader>
                <CardTitle className="text-sm font-medium text-muted-foreground">Contact</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Support Team</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Terms Content */}
          <div className="space-y-8">
            {/* Section 1 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">1</span>
                  Acceptance of Terms
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  By inviting and using the ComCraft Discord bot ("the Bot") in your Discord server, you agree to be bound by these Terms of Service. 
                  If you do not agree to these terms, please do not use the Bot. These terms apply to all users, including server owners, administrators, 
                  and members who interact with the Bot.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Your continued use of the Bot after any modifications to these Terms constitutes acceptance of such changes.
                </p>
              </CardContent>
            </Card>

            {/* Section 2 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">2</span>
                  Service Description
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  ComCraft is a multi-purpose Discord bot that provides various features including but not limited to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Server moderation tools and auto-moderation</li>
                  <li>Leveling and XP systems with customizable rewards</li>
                  <li>Custom welcome messages and auto-roles</li>
                  <li>Ticket systems for support management</li>
                  <li>Giveaway management</li>
                  <li>Stream notifications for Twitch and YouTube</li>
                  <li>AI-powered chat assistance and image generation</li>
                  <li>Custom embeds and auto-reactions</li>
                  <li>Game news notifications</li>
                  <li>Event management and RSVP tracking</li>
                  <li>Server analytics and insights</li>
                </ul>
              </CardContent>
            </Card>

            {/* Section 3 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">3</span>
                  Subscription Plans & Payment
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <h3 className="text-xl font-semibold mt-6 mb-3">3.1 Free Trial</h3>
                <p className="text-muted-foreground leading-relaxed">
                  New users receive a 30-day free trial period with access to all features. No payment information is required for the trial.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">3.2 Paid Subscriptions</h3>
                <p className="text-muted-foreground leading-relaxed">
                  After the trial period, you may choose from the following subscription tiers:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li><strong>Basic</strong> - Essential features for small communities</li>
                  <li><strong>Advanced</strong> - Extended features for growing servers</li>
                  <li><strong>Enterprise</strong> - Full feature access and priority support</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">3.3 Billing</h3>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Subscriptions are billed monthly or yearly based on your selection</li>
                  <li>Payment is processed through secure payment providers (Stripe, PayPal, iDEAL)</li>
                  <li>Prices are listed in EUR and may be subject to change with 30 days notice</li>
                  <li>All payments are non-refundable unless required by law</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">3.4 Cancellation</h3>
                <p className="text-muted-foreground leading-relaxed">
                  You may cancel your subscription at any time through the dashboard. Your access will continue until the end of the current billing period. 
                  No refunds will be provided for partial months.
                </p>
              </CardContent>
            </Card>

            {/* Section 4 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">4</span>
                  User Responsibilities
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  As a user of ComCraft, you agree to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Use the Bot in compliance with Discord's Terms of Service and Community Guidelines</li>
                  <li>Not use the Bot for any illegal or unauthorized purposes</li>
                  <li>Not attempt to exploit, hack, or reverse-engineer the Bot</li>
                  <li>Not use the Bot to spam, harass, or abuse other users</li>
                  <li>Not use the Bot to distribute malware or malicious content</li>
                  <li>Maintain the security of your account credentials</li>
                  <li>Ensure you have proper authorization to configure the Bot in any server</li>
                  <li>Not resell or redistribute Bot features or access</li>
                </ul>
              </CardContent>
            </Card>

            {/* Section 5 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">5</span>
                  Service Availability
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  We strive to maintain 99.9% uptime for the Bot. However, we do not guarantee uninterrupted service and may need to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Perform scheduled maintenance (announced in advance)</li>
                  <li>Conduct emergency maintenance for critical issues</li>
                  <li>Temporarily suspend service for security concerns</li>
                  <li>Modify or discontinue features with reasonable notice</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  We are not liable for any damages resulting from service interruptions or unavailability.
                </p>
              </CardContent>
            </Card>

            {/* Section 6 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">6</span>
                  Data & Privacy
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  Your privacy is important to us. The Bot collects and processes data as described in our Privacy Policy. 
                  By using the Bot, you consent to our data practices.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  For detailed information about what data we collect and how we use it, please review our 
                  <Link href="/comcraft/privacy" className="text-primary hover:underline ml-1">Privacy Policy</Link>.
                </p>
              </CardContent>
            </Card>

            {/* Section 7 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">7</span>
                  Intellectual Property
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  The Bot, including its code, design, features, and branding, is the intellectual property of CodeCraft Solutions. 
                  You are granted a limited, non-exclusive, non-transferable license to use the Bot for its intended purpose.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  You retain ownership of any content you create using the Bot (custom commands, embeds, etc.), but grant us 
                  permission to use, store, and process this content to provide the service.
                </p>
              </CardContent>
            </Card>

            {/* Section 8 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">8</span>
                  Termination
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  We reserve the right to suspend or terminate your access to the Bot at any time, without notice, for:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Violation of these Terms of Service</li>
                  <li>Violation of Discord's Terms of Service</li>
                  <li>Non-payment of subscription fees</li>
                  <li>Abusive or malicious use of the Bot</li>
                  <li>Activities that harm the service or other users</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Upon termination, your data may be deleted in accordance with our Privacy Policy. 
                  Termination does not entitle you to a refund of any fees paid.
                </p>
              </CardContent>
            </Card>

            {/* Section 9 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">9</span>
                  Limitation of Liability
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  To the maximum extent permitted by law, CodeCraft Solutions shall not be liable for:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Any indirect, incidental, special, consequential, or punitive damages</li>
                  <li>Loss of profits, data, or goodwill</li>
                  <li>Service interruptions or errors</li>
                  <li>Actions or content of third-party users</li>
                  <li>Damages exceeding the amount you paid for the service in the past 3 months</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  The Bot is provided "as is" without warranties of any kind, either express or implied.
                </p>
              </CardContent>
            </Card>

            {/* Section 10 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">10</span>
                  Referral Program
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  Users may participate in our referral program to earn rewards. By participating, you agree to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Use referral links only for legitimate promotional purposes</li>
                  <li>Not engage in spam or fraudulent referral activities</li>
                  <li>Not create fake accounts or manipulate the system</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  We reserve the right to void referrals and revoke rewards if fraud or abuse is detected.
                </p>
              </CardContent>
            </Card>

            {/* Section 11 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">11</span>
                  Changes to Terms
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  We may update these Terms from time to time. When we make significant changes, we will:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Update the "Last updated" date at the top of this page</li>
                  <li>Notify users through the Bot or email (for major changes)</li>
                  <li>Post announcements on our Discord server</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Your continued use of the Bot after changes constitutes acceptance of the updated Terms.
                </p>
              </CardContent>
            </Card>

            {/* Section 12 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">12</span>
                  Contact Information
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  If you have questions about these Terms of Service, please contact us:
                </p>
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                    <Mail className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-semibold">Email Support</p>
                      <Link href="/contact" className="text-primary hover:underline">Contact Form</Link>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                    <Shield className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-semibold">Discord Support</p>
                      <p className="text-sm text-muted-foreground">Join our support server</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Bottom Notice */}
          <Card className="mt-12 border-2 border-primary/20 bg-primary/5">
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="p-3 bg-primary/10 rounded-full">
                  <Shield className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Your Agreement</h3>
                  <p className="text-muted-foreground leading-relaxed">
                    By using ComCraft, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service. 
                    If you do not agree to these terms, please discontinue use of the Bot immediately.
                  </p>
                  <div className="mt-4 flex gap-3">
                    <Link href="/comcraft/privacy">
                      <Button variant="outline" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Read Privacy Policy
                      </Button>
                    </Link>
                    <Link href="/products/comcraft">
                      <Button className="gap-2">
                        <ArrowLeft className="h-4 w-4" />
                        Back to ComCraft
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  )
}

