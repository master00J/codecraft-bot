"use client"

import { Link } from '@/navigation'
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Shield, Lock, Eye, Database, UserCheck, Clock, Mail, AlertTriangle, FileText } from "lucide-react"
import Navbar from "@/components/navbar"
import Footer from "@/components/footer"

export default function ComCraftPrivacyPage() {
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
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-5xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                  Privacy Policy
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
          <div className="grid md:grid-cols-4 gap-4 mb-12">
            <Card className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-medium">Data Security</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Encrypted & Protected</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-medium">Transparency</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Clear Data Usage</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-medium">Your Rights</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">GDPR Compliant</p>
              </CardContent>
            </Card>
            <Card className="border-2">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-primary" />
                  <CardTitle className="text-sm font-medium">Data Control</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground">Request Deletion</p>
              </CardContent>
            </Card>
          </div>

          {/* Introduction */}
          <Card className="mb-8 border-2 border-primary/30 bg-primary/5">
            <CardContent className="p-8">
              <h2 className="text-2xl font-bold mb-4">Your Privacy Matters</h2>
              <p className="text-muted-foreground leading-relaxed">
                At CodeCraft Solutions, we take your privacy seriously. This Privacy Policy explains how ComCraft ("the Bot") 
                collects, uses, stores, and protects your personal information when you use our Discord bot services.
              </p>
              <p className="text-muted-foreground leading-relaxed mt-4">
                By using ComCraft, you agree to the collection and use of information in accordance with this policy. 
                We are committed to protecting your data and being transparent about our practices.
              </p>
            </CardContent>
          </Card>

          {/* Privacy Content */}
          <div className="space-y-8">
            {/* Section 1 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">1</span>
                  Information We Collect
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <h3 className="text-xl font-semibold mt-6 mb-3">1.1 Discord Account Information</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When you authorize ComCraft through Discord OAuth, we collect:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Discord User ID (unique identifier)</li>
                  <li>Username and discriminator (e.g., User#1234)</li>
                  <li>Email address (if provided through OAuth)</li>
                  <li>Avatar URL</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">1.2 Server (Guild) Information</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When the Bot is added to a Discord server, we collect:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Server ID and name</li>
                  <li>Server owner ID</li>
                  <li>Channel IDs and names where the Bot is configured</li>
                  <li>Role IDs and names (for permission management)</li>
                  <li>Member count and basic server statistics</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">1.3 Usage Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We collect data about how you interact with the Bot:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Commands used and their frequency</li>
                  <li>Feature configuration settings</li>
                  <li>XP and leveling progress</li>
                  <li>Message statistics (for leveling and analytics)</li>
                  <li>Moderation actions and logs</li>
                  <li>Ticket conversations and support interactions</li>
                  <li>Event RSVPs and attendance</li>
                  <li>AI chat interactions and prompts</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">1.4 Payment Information</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When you subscribe to a paid plan:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Payment method details (processed securely by Stripe/PayPal)</li>
                  <li>Billing address and name</li>
                  <li>Transaction history and invoices</li>
                  <li>Subscription tier and renewal dates</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  <strong>Note:</strong> We do not store complete credit card numbers. Payment processing is handled by certified 
                  third-party payment processors (Stripe, PayPal) that are PCI-DSS compliant.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">1.5 Third-Party Integration Data</h3>
                <p className="text-muted-foreground leading-relaxed">
                  When you connect third-party services (Twitch, YouTube):
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Twitch/YouTube channel information and access tokens</li>
                  <li>Stream status and subscriber events</li>
                  <li>Channel IDs and display names</li>
                </ul>
              </CardContent>
            </Card>

            {/* Section 2 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">2</span>
                  How We Use Your Information
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  We use the collected information for the following purposes:
                </p>
                <ul className="list-disc pl-6 space-y-3 text-muted-foreground mt-4">
                  <li>
                    <strong>Service Delivery:</strong> To provide and maintain Bot functionality, including all features and commands
                  </li>
                  <li>
                    <strong>Authentication:</strong> To identify and authenticate users accessing the dashboard
                  </li>
                  <li>
                    <strong>Personalization:</strong> To customize Bot behavior based on your server settings and preferences
                  </li>
                  <li>
                    <strong>Analytics:</strong> To generate server statistics, insights, and usage reports
                  </li>
                  <li>
                    <strong>Support:</strong> To respond to your support requests and troubleshoot issues
                  </li>
                  <li>
                    <strong>Billing:</strong> To process payments and manage subscriptions
                  </li>
                  <li>
                    <strong>Communication:</strong> To send important updates, announcements, and notifications
                  </li>
                  <li>
                    <strong>Security:</strong> To detect and prevent abuse, fraud, or unauthorized access
                  </li>
                  <li>
                    <strong>Improvement:</strong> To analyze usage patterns and improve Bot features
                  </li>
                  <li>
                    <strong>Legal Compliance:</strong> To comply with applicable laws and regulations
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Section 3 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">3</span>
                  Data Storage & Security
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <h3 className="text-xl font-semibold mt-6 mb-3">3.1 Storage Location</h3>
                <p className="text-muted-foreground leading-relaxed">
                  Your data is stored on secure servers provided by Supabase (PostgreSQL database) hosted in Europe. 
                  We use industry-standard encryption for data at rest and in transit.
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">3.2 Security Measures</h3>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>SSL/TLS encryption for all data transmission</li>
                  <li>Encrypted database storage</li>
                  <li>Regular security audits and updates</li>
                  <li>Access controls and authentication</li>
                  <li>Automated backups and disaster recovery</li>
                  <li>Row-level security (RLS) policies in database</li>
                  <li>Rate limiting and DDoS protection</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">3.3 Data Retention</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We retain your data for as long as:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Your account is active</li>
                  <li>Needed to provide services</li>
                  <li>Required by law (e.g., transaction records)</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  After account deletion, most data is removed within 30 days. Some data may be retained longer for legal or security purposes.
                </p>
              </CardContent>
            </Card>

            {/* Section 4 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">4</span>
                  Data Sharing & Disclosure
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  We do not sell your personal information. We may share your data only in the following circumstances:
                </p>

                <h3 className="text-xl font-semibold mt-6 mb-3">4.1 Service Providers</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We work with trusted third-party services:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li><strong>Supabase:</strong> Database hosting and authentication</li>
                  <li><strong>Stripe & PayPal:</strong> Payment processing</li>
                  <li><strong>Discord API:</strong> Bot functionality</li>
                  <li><strong>Twitch/YouTube APIs:</strong> Stream notifications</li>
                  <li><strong>OpenAI/Anthropic:</strong> AI-powered features</li>
                  <li><strong>Vercel:</strong> Web hosting and CDN</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">4.2 Legal Requirements</h3>
                <p className="text-muted-foreground leading-relaxed">
                  We may disclose your information if required by law or to:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Comply with legal obligations or court orders</li>
                  <li>Protect our rights and property</li>
                  <li>Prevent fraud or security threats</li>
                  <li>Protect user safety</li>
                </ul>

                <h3 className="text-xl font-semibold mt-6 mb-3">4.3 Business Transfers</h3>
                <p className="text-muted-foreground leading-relaxed">
                  If CodeCraft Solutions is involved in a merger, acquisition, or sale of assets, your data may be 
                  transferred. We will notify you of any such change.
                </p>
              </CardContent>
            </Card>

            {/* Section 5 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">5</span>
                  Your Privacy Rights (GDPR)
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  Under the General Data Protection Regulation (GDPR), you have the following rights:
                </p>

                <div className="space-y-4 mt-6">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">🔍 Right to Access</h4>
                    <p className="text-sm text-muted-foreground">
                      You can request a copy of all personal data we hold about you.
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">✏️ Right to Rectification</h4>
                    <p className="text-sm text-muted-foreground">
                      You can request correction of inaccurate or incomplete data.
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">🗑️ Right to Erasure ("Right to be Forgotten")</h4>
                    <p className="text-sm text-muted-foreground">
                      You can request deletion of your personal data. We will comply unless we have legal obligations to retain it.
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">⛔ Right to Restriction</h4>
                    <p className="text-sm text-muted-foreground">
                      You can request to limit how we process your data in certain circumstances.
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">📤 Right to Data Portability</h4>
                    <p className="text-sm text-muted-foreground">
                      You can request your data in a machine-readable format to transfer to another service.
                    </p>
                  </div>

                  <div className="p-4 bg-muted/50 rounded-lg">
                    <h4 className="font-semibold text-lg mb-2">🚫 Right to Object</h4>
                    <p className="text-sm text-muted-foreground">
                      You can object to certain types of data processing, such as direct marketing.
                    </p>
                  </div>
                </div>

                <p className="text-muted-foreground leading-relaxed mt-6">
                  To exercise any of these rights, please contact us through our support channels. 
                  We will respond to your request within 30 days.
                </p>
              </CardContent>
            </Card>

            {/* Section 6 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">6</span>
                  Cookies & Tracking
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  Our website and dashboard use cookies and similar technologies:
                </p>
                <ul className="list-disc pl-6 space-y-3 text-muted-foreground mt-4">
                  <li>
                    <strong>Essential Cookies:</strong> Required for authentication and basic functionality (e.g., session cookies)
                  </li>
                  <li>
                    <strong>Analytics Cookies:</strong> Help us understand how visitors use our website (can be opted out)
                  </li>
                  <li>
                    <strong>Preference Cookies:</strong> Remember your settings and preferences
                  </li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  You can control cookies through your browser settings. Note that disabling cookies may affect functionality.
                </p>
              </CardContent>
            </Card>

            {/* Section 7 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">7</span>
                  Children's Privacy
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  ComCraft is designed for general audiences. We do not knowingly collect personal information from children under 13 
                  (or 16 in the EU). Discord's Terms of Service require users to be at least 13 years old.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  If we become aware that we have collected data from a child without parental consent, we will take steps to 
                  delete that information promptly.
                </p>
              </CardContent>
            </Card>

            {/* Section 8 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">8</span>
                  AI-Generated Content
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  When you use AI features (chat, image generation):
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Your prompts are sent to third-party AI providers (OpenAI, Anthropic, Stability AI)</li>
                  <li>We log prompts for usage tracking and billing purposes</li>
                  <li>AI providers may use prompts to improve their models (per their policies)</li>
                  <li>Generated content is stored temporarily and may be cached</li>
                  <li>Do not include sensitive personal information in AI prompts</li>
                </ul>
              </CardContent>
            </Card>

            {/* Section 9 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">9</span>
                  International Data Transfers
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  Our primary data storage is located in Europe (GDPR-compliant regions). However, some third-party services 
                  (e.g., Discord, OpenAI) may process data in other countries, including the United States.
                </p>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  We ensure that any international data transfers comply with applicable data protection laws through 
                  appropriate safeguards such as Standard Contractual Clauses (SCCs).
                </p>
              </CardContent>
            </Card>

            {/* Section 10 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">10</span>
                  Data Breach Notification
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  In the unlikely event of a data breach that may affect your personal information, we will:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>Notify affected users within 72 hours of discovery</li>
                  <li>Inform relevant data protection authorities as required by law</li>
                  <li>Provide details about the breach and steps taken to address it</li>
                  <li>Offer guidance on protecting your account</li>
                </ul>
              </CardContent>
            </Card>

            {/* Section 11 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">11</span>
                  Changes to Privacy Policy
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed">
                  We may update this Privacy Policy from time to time. When we make significant changes:
                </p>
                <ul className="list-disc pl-6 space-y-2 text-muted-foreground mt-4">
                  <li>We will update the "Last updated" date at the top</li>
                  <li>We will notify users via email or Bot announcement</li>
                  <li>We will post a notice on our website</li>
                </ul>
                <p className="text-muted-foreground leading-relaxed mt-4">
                  Your continued use of ComCraft after changes indicates acceptance of the updated policy.
                </p>
              </CardContent>
            </Card>

            {/* Section 12 */}
            <Card className="border-2 hover:border-primary/50 transition-colors">
              <CardHeader>
                <CardTitle className="text-2xl flex items-center gap-3">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">12</span>
                  Contact & Data Requests
                </CardTitle>
              </CardHeader>
              <CardContent className="prose prose-lg dark:prose-invert max-w-none">
                <p className="text-muted-foreground leading-relaxed mb-6">
                  If you have questions about this Privacy Policy or want to exercise your data rights, contact us:
                </p>
                <div className="space-y-3">
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
                      <p className="text-sm text-muted-foreground">Join our support server for assistance</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
                    <Database className="h-5 w-5 text-primary" />
                    <div>
                      <p className="font-semibold">Data Export/Deletion</p>
                      <p className="text-sm text-muted-foreground">Request through dashboard or support</p>
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
                  <AlertTriangle className="h-6 w-6 text-primary" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Important Notice</h3>
                  <p className="text-muted-foreground leading-relaxed mb-4">
                    This Privacy Policy works together with our Terms of Service. By using ComCraft, you acknowledge 
                    that you have read and understood both documents.
                  </p>
                  <div className="flex gap-3 flex-wrap">
                    <Link href="/comcraft/terms">
                      <Button variant="outline" className="gap-2">
                        <FileText className="h-4 w-4" />
                        Read Terms of Service
                      </Button>
                    </Link>
                    <Link href="/contact">
                      <Button variant="outline" className="gap-2">
                        <Mail className="h-4 w-4" />
                        Contact Support
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

          {/* Quick Actions */}
          <div className="mt-8 grid md:grid-cols-3 gap-4">
            <Card className="border-2 hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-6 text-center">
                <Database className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Export Your Data</h3>
                <p className="text-sm text-muted-foreground">Download all your personal data</p>
              </CardContent>
            </Card>
            <Card className="border-2 hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-6 text-center">
                <Shield className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Privacy Settings</h3>
                <p className="text-sm text-muted-foreground">Manage your preferences</p>
              </CardContent>
            </Card>
            <Card className="border-2 hover:border-primary/50 transition-colors cursor-pointer">
              <CardContent className="p-6 text-center">
                <AlertTriangle className="h-8 w-8 text-primary mx-auto mb-3" />
                <h3 className="font-semibold mb-2">Delete Account</h3>
                <p className="text-sm text-muted-foreground">Permanently remove your data</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  )
}

