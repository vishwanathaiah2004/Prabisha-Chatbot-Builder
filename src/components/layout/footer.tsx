"use client"

import Link from "next/link"
import Image from "next/image"
import type React from "react"
import { useState } from "react"
import { Mail, Phone, Twitter, Linkedin, Instagram, MapPin, Facebook } from "lucide-react"

export default function Footer() {
  const [email, setEmail] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) return

    setIsSubmitting(true)
    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsSubmitting(false)
    setEmail("")
  }

  const socialLinks = [
    { icon: Twitter, href: "https://x.com/PrabishaC", label: "Twitter" },
    { icon: Linkedin, href: "https://www.linkedin.com/company/prabisha", label: "LinkedIn" },
    { icon: Facebook, href: "http://facebook.com/prabishaconsulting/", label: "Facebook" },
    { icon: Instagram, href: "https://www.instagram.com/prabishauk/", label: "Instagram" },
  ]

  return (
    <footer className="relative bg-background text-foreground overflow-hidden border-t border-border">
      {/* Background Pattern removed (was hardcoded color). Keep node hidden to avoid deletion diff. */}
      <div className="hidden" />

      <div className="relative p-6">
        {/* Main Footer Content */}
        <div className="grid lg:grid-cols-6 md:grid-cols-2 gap-12 mb-16">
          {/* Brand Section */}
          <div className="lg:col-span-2 space-y-6">
            <Image
              src="/icons/logo.png"
              alt="logo"
              height={60}
              width={200}
              unoptimized
            />
            <p className="text-muted-foreground leading-relaxed text-lg max-w-md">
              Empowering businesses with AI-driven marketing automation solutions that deliver real results and drive
              sustainable growth.
            </p>

            {/* Contact Info */}
            <div className="space-y-3">
              <div className="flex items-center space-x-3 text-muted-foreground">
                <Mail className="w-5 h-5 text-primary" />
                <span>pratyush@prabisha.com</span>
              </div>
              <div className="flex items-center space-x-3 text-muted-foreground">
                <Phone className="w-5 h-5 text-primary" />
                <span>+44 786 7090363</span>
              </div>
              <div className="flex items-center space-x-3 text-muted-foreground">
                <MapPin className="w-5 h-5 text-primary" />
                <span>London, UK HA1 1EH</span>
              </div>
            </div>
          </div>

          {/* Navigation Sections */}
          {[
            {
              title: "Company",
              links: [
                { name: "About Us", href: "https://prabisha.com/about/" },
                { name: "Careers", href: "https://hr.prabisha.com/" },
                { name: "Contact", href: "https://prabisha.com/contact/" },
              ],
            },
            {
              title: "Resources",
              links: [
                { name: "Privacy Policy", href: "https://www.prishatheexplorer.com/privacy-policy/" },
                { name: "Terms of Service", href: "https://prishatheexplorer.com/terms-of-service/" },
                { name: "Cookie Policy", href: "/cookie-policy" },
                { name: "Help Center", href: "/help-center" },
              ],
            },
          ].map((section, index) => (
            <div key={index} className="space-y-6">
              <h3 className="font-bold text-xl text-foreground relative">
                {section.title}
                <div className="absolute -bottom-2 left-0 w-8 h-0.5 bg-primary rounded-full"></div>
              </h3>
              <ul className="space-y-4">
                {section.links.map((link, linkIndex) => (
                  <li key={linkIndex}>
                    <a
                      href={link.href}
                      className="text-muted-foreground hover:text-foreground transition-all duration-200 hover:translate-x-1 inline-block relative group"
                    >
                      {link.name}
                      <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div className="space-y-6 lg:col-span-2">
            <h3 className="text-2xl font-bold text-foreground mb-2">Follow Us on</h3>

            {/* Social Links */}
            <div className="flex space-x-4 pt-4">
              {socialLinks.map((social, index) => (
                <Link
                  key={index}
                  href={social.href}
                  aria-label={social.label}
                  className="w-10 h-10 bg-muted hover:bg-primary rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-110 hover:shadow-lg group"
                >
                  <social.icon className="w-5 h-5 text-muted-foreground group-hover:text-primary-foreground transition-colors" />
                </Link>
              ))}
            </div>

            <div>
              <h3 className="text-2xl font-bold text-foreground mb-2">Stay in the Loop</h3>
              <p className="text-muted-foreground">
                Get the latest updates, insights, and exclusive content delivered to your inbox.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-4 max-w-md mx-auto">
              <div className="flex-1 relative">
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  placeholder="Enter your email address"
                  required
                  className="w-full p-2 bg-background border border-input rounded-2xl focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent text-foreground placeholder-muted-foreground transition-all duration-200"
                />
              </div>
              <button
                type="submit"
                disabled={isSubmitting}
                className={`p-2 bg-primary text-primary-foreground font-semibold rounded-2xl transition-all duration-200 hover:bg-primary/90 hover:scale-105 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${isSubmitting ? "animate-pulse" : ""}`}
              >
                {isSubmitting ? "Subscribing..." : "Subscribe"}
              </button>
            </form>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="border-t border-border pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center space-y-4 md:space-y-0">
            <p className="text-muted-foreground text-center md:text-left">
              © 2026 Prabisha Consulting. All rights reserved.
            </p>
            <div className="flex items-center space-x-6 text-muted-foreground">
              <span className="flex items-center space-x-2">
                <span>Built with</span>
                <span className="text-primary animate-pulse">❤️</span>
                <span>for modern marketers</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
