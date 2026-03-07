"use client";

import Link from "next/link";
import Image from "next/image";
import { useState } from "react";
import { Menu, X, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import ThemeToggle from "../features/theme-toggle";
import { signIn } from "next-auth/react";

/* ---------------- TYPES ---------------- */
interface SubItem {
  title: string;
  href: string;
}

interface MenuItem {
  title: string;
  items: SubItem[];
}

/* ---------------- MOBILE MENU ITEM ---------------- */
const MobileMenuItem = ({
  item,
  onCloseMenu,
}: {
  item: MenuItem;
  onCloseMenu: () => void;
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <div className="border-b border-gray-50 last:border-b-0">
      <div
        className="flex items-center justify-between p-4 cursor-pointer select-none hover:bg-gray-50"
        onClick={() => setIsCollapsed((prev) => !prev)}
      >
        <span className="text-sm font-semibold text-gray-700">{item.title}</span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform text-gray-400",
            isCollapsed && "rotate-180"
          )}
        />
      </div>

      <AnimatePresence>
        {isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden bg-gray-50/50"
          >
            <div className="py-2 pl-8 space-y-3 pb-4">
              {item.items.map((sub) => (
                <Link
                  key={sub.title}
                  href={sub.href}
                  className="block text-sm text-gray-500 hover:text-black transition-colors"
                  onClick={onCloseMenu}
                >
                  {sub.title}
                </Link>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ---------------- DESKTOP LIST ITEM ---------------- */
const ListItem = ({ title, href }: { title: string; href: string }) => {
  const isExternal = href.startsWith("http");
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          href={href}
          target={isExternal ? "_blank" : "_self"}
          rel={isExternal ? "noopener noreferrer" : undefined}
          className="block rounded-lg p-3 text-sm transition-colors hover:bg-gray-50 hover:text-blue-600"
        >
          {title}
        </Link>
      </NavigationMenuLink>
    </li>
  );
};

/* ---------------- HEADER ---------------- */
export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  const handleLogin = async (callbackUrl = "/dashboard") => {
    try {
      await signIn("central-auth", { callbackUrl });
    } catch (error) {
      console.error("Central login error:", error);
    }
  };

  const menuItems: MenuItem[] = [
    {
      title: "Services",
      items: [
        { title: "SEO Optimization", href: "https://prabisha.com/seo/" },
        { title: "Social Media Marketing", href: "https://prabisha.com/social-media-marketing/" },
        { title: "Content Marketing", href: "https://prabisha.com/content-marketing/" },
        { title: "Email Marketing", href: "https://prabisha.com/email-marketing/" },
        { title: "PPC Advertising", href: "https://prabisha.com/ppc/" },
      ],
    },
    {
      title: "Products",
      items: [
        { title: "SEO Solutions", href: "https://seo.prabisha.com/" },
        { title: "Intranet", href: "https://intranet.prabisha.com/" },
        { title: "Project Management", href: "https://projects.prabisha.com/" },
        { title: "HR Management", href: "https://hrms.prabisha.com/" },
        { title: "LMS Portal", href: "https://lms.prabisha.com/" },
        { title: "UKBiz Network", href: "https://ukbiznetwork.com/" },
        { title: "EcoKartUK", href: "https://www.ecokartuk.com/" },
      ]
    },

    {
      title: "Company",
      items: [
        { title: "About Us", href: "https://prabisha.com/about/" },
        { title: "Careers", href: "https://hr.prabisha.com/" },
        { title: "Contact", href: "https://prabisha.com/contact/" },
      ],
    },

  ];

  return (
    <nav className="fixed top-0 w-full bg-white/70 dark:bg-[#0B0F1A]/70 backdrop-blur-xl z-50 border-b border-gray-200/60 dark:border-gray-800/60 transition-all duration-300">
    <div className="max-w-7xl mx-auto px-6 lg:px-8 h-20 flex items-center justify-between">

        {/* LOGO SECTION - Restored your original logo */}
        <div className="flex items-center gap-2">
          <Link href="/" className="flex items-center gap-3">
            <Image
              src="/icons/logo1.png"
              alt="logo"
              width={40}
              height={40}
              className="object-contain"
            />
            <span className="text-xl font-bold tracking-tight text-gray-900 dark:text-white hidden sm:block">
              Chatbot Builder
            </span>
          </Link>
        </div>

        {/* DESKTOP NAV (SHADCN) */}
        <div className="hidden lg:flex items-center">
          <NavigationMenu>
            <NavigationMenuList className="gap-2">
              {menuItems.map((item) => (
                <NavigationMenuItem key={item.title}>
                  <NavigationMenuTrigger className="bg-transparent text-gray-500 dark:text-gray-400 hover:text-black dark:hover:text-white font-medium text-[14px] transition-all duration-300 data-[state=open]:bg-transparent">
                    {item.title}
                  </NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-2 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                      {item.items.map((sub) => (
                        <ListItem key={sub.title} title={sub.title} href={sub.href} />
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>
              ))}
            </NavigationMenuList>
          </NavigationMenu>
        </div>

        {/* ACTIONS */}
        <div className="flex items-center gap-3">
          <ThemeToggle />

          <button
            onClick={() => handleLogin()}
            className="hidden md:block text-sm font-semibold px-4 text-gray-600 hover:text-black transition-colors"
          >
            Sign In
          </button>

          <button
            onClick={() => handleLogin()}
           className="relative overflow-hidden bg-gradient-to-r from-[#111827] to-[#1F2937] text-white px-6 py-2.5 rounded-full text-sm font-bold shadow-lg shadow-black/20 hover:scale-105 transition-all duration-300 active:scale-95">
            Get Started
          </button>

          {/* MOBILE TOGGLE */}
          <Button
            size="icon"
            variant="ghost"
            className="lg:hidden ml-1"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </Button>
        </div>
      </div>

      {/* MOBILE MENU */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="lg:hidden absolute top-20 left-0 w-full bg-white border-b border-gray-100 shadow-xl overflow-hidden"
          >
            <div className="flex flex-col p-2 max-h-[80vh] overflow-y-auto">
              {menuItems.map((item) => (
                <MobileMenuItem
                  key={item.title}
                  item={item}
                  onCloseMenu={() => setIsOpen(false)}
                />
              ))}
              <div className="p-4 pt-2">
                <Button
                  className="w-full rounded-full bg-[#111827]"
                  onClick={() => handleLogin()}
                >
                  Get Started
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}