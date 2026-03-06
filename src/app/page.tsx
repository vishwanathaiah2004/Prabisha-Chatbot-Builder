"use client";
import React, { useState } from 'react';
import Image from 'next/image';
import Header from '@/components/layout/header';
import Footer from '@/components/layout/footer';
import { signIn } from 'next-auth/react';

export default function SourceBytesOfficialUI() {
  const [activeIndex, setActiveIndex] = useState(1);

  const features = [
    {
      id: 0,
      category: "Knowledgebase",
      title: "Knowledgebase for Bots & Voice Agents",
      desc: "Centralize information into a single knowledgebase that bot and voice agents can query in real time, ensuring fast, accurate, and consistent responses based on the latest data.",
      bg: "bg-[#E6B990]",
      icon: "right"
    },
    {
      id: 1,
      category: "AI Chatbot",
      title: "24/7 Customer Engagement",
      desc: "Keep users engaged at all hours, answer queries, and escalate complex issues to human agents as needed.",
      bg: "bg-[#EDA0A8]",
      icon: "left"
    },
    {
      id: 2,
      category: "Knowledgebase",
      title: "Compliance & Policy Reference",
      desc: "Centralize company policies and compliance guidelines to ensure consistent access and adherence.",
      bg: "bg-[#D9D9D9]",
      icon: "right"
    },
    {
      id: 3,
      category: "AI Chatbot",
      title: "Lead Generation & Qualification",
      desc: "Interact with visitors, ask qualifying questions, and capture details to forward to sales teams automatically.",
      bg: "bg-[#8E7EAA]",
      icon: "right"
    }
  ];

  const languages = [
    { name: 'English', code: 'en', img: '/flags/en.svg' },
    { name: 'Japanese', code: 'ja', img: '/flags/ja.svg' },
    { name: 'Hindi', code: 'hi', img: '/flags/hi.svg' },
    { name: 'French', code: 'fr', img: '/flags/fr.svg' },
    { name: 'Spanish', code: 'es', img: '/flags/es.svg' },
    { name: 'Arabic', code: 'ar', img: '/flags/ar.svg' }
  ]

  const handleLogin = async (callbackUrl = "/dashboard") => {
    try {
      await signIn("central-auth", { callbackUrl });
    } catch (error) {
      console.error("Central login error:", error);
    }
  };

  return (
    <>
      <Header />
      <div
        style={{ fontFamily: '"GeistSans", "GeistSans Fallback", sans-serif' }}
        className="mt-20 w-full min-h-screen responsive-headers font-sans selection:bg-[#EF6A37]/30"
      >

        {/* SECTION 1: HERO */}
        <section className="lg:min-h-[calc(100vh-100px)] mx-auto my-6 sm:my-8 flex items-center justify-center relative">
          <div className="xl:container mx-auto w-full pl-4 sm:pl-8 lg:pl-14 flex flex-col lg:flex-row justify-center items-center my-auto lg:gap-24 gap-6">
            <div className="w-full mx-auto lg:flex-1">
              <h1 className="text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold tracking-tighter text-gray-900 dark:text-white">
                Unlock the future of business
              </h1>
              <span className="block text-3xl sm:text-4xl md:text-6xl lg:text-7xl font-bold max-w-3xl text-[#EF6A37] tracking-tighter">
                automation
              </span>
              <p className="w-full text-base sm:text-lg md:text-xl lg:text-2xl lg:max-w-[700px] my-4 pt-4 pr-4 text-gray-600 dark:text-gray-300">
                Our platform centralizes your data and empowers organizations to leverage state-of-the-art AI for smarter conversations, automated tasks, and instant insights.
              </p>
            </div>
            <div className="relative lg:flex-1 gap-6 w-full">
              {/* Note: The 'font-cavet' class requires the Caveat font to be loaded in your layout */}
              <span className="w-fit block mb-4 lg:mb-0 lg:absolute lg:top-1/2 lg:-left-20 font-bold bg-[#F5F5FD] dark:bg-[#2A2A3B] text-black dark:text-white p-2 px-6 rounded-xl text-lg md:text-2xl shadow-sm z-10">
                AI Powered
              </span>
              <div className="bg-gray-100 dark:bg-[#1C1C28] rounded-[24px] sm:rounded-[40px] aspect-[740/500] w-full flex items-center justify-center border border-gray-200 dark:border-gray-700">                <Image src="/home/main.jpg" alt="Hero Image" width={740} height={500} className="object-cover rounded-[40px]" />
              </div>
            </div>
          </div>
        </section>

        {/* SECTION 2: CHAT & VOICE CARDS */}
        <section className="container mx-auto w-full my-16 gap-6 px-4">
          <div className="text-center mb-6 lg:mb-12">
           <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-gray-900 dark:text-white">
              AI at the Heart of User Experience
            </h1>
           <p className="mx-auto mb-4 mt-4 max-w-4xl text-base sm:text-lg md:text-xl text-gray-500 dark:text-gray-300">
              Empower your business with SourceBytes.AI’s tools and experience a transformation in how you work.
            </p>
          </div>
          <div className="flex flex-col md:flex-row flex-wrap gap-10">
            <button onClick={() => handleLogin()} className="cursor-pointer flex flex-col flex-1 min-h-[352px] bg-[#214678] lg:p-12 md:p-8 px-6 py-8 items-center justify-center gap-4 rounded-xl md:rounded-[80px] group transition-all">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-white font-bold tracking-tight group-hover:text-[#378DEF] transition-all duration-300 text-4xl md:text-5xl lg:text-6xl text-center">
                  ChatBot Builder
                </h1>
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-[#378DEF] transition-colors">
                  <span className="text-white">↗</span>
                </div>
              </div>
              <p className="text-white/90 text-base sm:text-lg md:text-xl text-center max-w-md">
                Allows you to create powerful, conversational chatbots tailored for your business. No technical skills required, no extra fees, no coding required.
              </p>
            </button>
            <button onClick={() => handleLogin()} className="cursor-pointer flex flex-col flex-1 min-h-[352px] bg-[#0C1C2E] lg:p-12 md:p-8 px-6 py-8 items-center justify-center gap-4 rounded-xl md:rounded-[80px] group transition-all">
              <div className="flex items-center justify-center gap-2">
                <h1 className="text-white font-bold tracking-tight group-hover:text-[#378DEF] transition-all duration-300 text-4xl md:text-5xl lg:text-6xl text-center">
                  AI Voice Agents
                </h1>
                <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center group-hover:bg-[#378DEF] transition-colors">
                  <span className="text-white">↗</span>
                </div>
              </div>
             <p className="text-white/90 text-base sm:text-lg md:text-xl text-center max-w-md">
                Handles inbound and outbound calls, offers natural interactions, enhances troubleshooting, and supports process scaling.
              </p>
            </button>
          </div>
        </section>

        {/* SECTION 3: FEATURE BENTO GRID */}
        <section className="container mx-auto lg:pt-12 pt-6">
          <div className="flex flex-col items-center justify-center mb-12">
            <div className="w-full">

              {/* DESKTOP BENTO GRID (Expandable) */}
              <div className="hidden lg:flex gap-4 w-full h-[314px]">
                {features.map((feature, index) => (
                  <div
                    key={index}
                    onClick={() => setActiveIndex(index)}
                    className={`relative rounded-3xl cursor-pointer transition-all duration-500 ease-in-out hover:shadow-lg overflow-hidden flex ${feature.bg} 
                      ${activeIndex === index ? 'flex-[3_1_0%]' : 'flex-1'}`}
                  >
                    <div className="relative w-full h-full p-4 md:p-8 px-16">
                      <div className="rounded-xl px-4 text-base font-semibold text-[#C5C5C5] my-6 w-fit py-2 shadow bg-[#393646]">
                        {feature.category}
                      </div>

                      {/* Icon that rotates/flips based on state */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                        className={`lucide absolute top-6 right-4 transform transition-transform duration-300 ${activeIndex === index ? 'rotate-180' : 'rotate-0'}`}
                      >
                        <path d="M5 12h14"></path>
                        <path d="m12 5 7 7-7 7"></path>
                      </svg>

                      <h1 className="text-[22px] font-bold text-[#000000]">{feature.title}</h1>

                      {/* Only show description if active */}
                      <div className={`transition-opacity duration-500 ${activeIndex === index ? 'opacity-100 block' : 'opacity-0 hidden'}`}>
                        <p className="text-[#000000] mt-2 text-lg/tight">
                          {feature.desc}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* MOBILE LIST VIEW */}
              <div className="flex flex-col gap-4 lg:hidden px-4">
                {features.map((feature, index) => (
                  <div key={index} className={`rounded-3xl overflow-hidden flex flex-col p-4 gap-2 ${feature.bg}`}>
                    <div className="rounded-xl px-4 text-base font-semibold text-[#C5C5C5] my-6 w-fit ml-2 py-2 shadow bg-[#393646]">
                      {feature.category}
                    </div>
                    <div className="relative flex-1 w-full h-auto">
                      <h1 className="text-2xl font-bold">{feature.title}</h1>
                    </div>
                    <p className="text-gray-800 pb-2 text-justify text-lg">{feature.desc}</p>
                  </div>
                ))}
              </div>

            </div>
          </div>
        </section>

        {/* SECTION 4: LANGUAGES (Dark Context) */}
        <section className="container mx-auto py-16 md:py-20 xl:py-24 my-12 bg-[#20202F] rounded-3xl">
          <div className="grid grid-cols-1 md:grid-cols-2 mx-auto px-6 lg:px-16 gap-8 items-center">
            <div className="space-y-6">
              <h1 className="font-bold tracking-tighter text-white text-4xl md:text-5xl lg:text-6xl">
                Supported Languages
              </h1>
              <p className="text-xl text-white/70 leading-relaxed">
                Deliver conversations in multiple languages with natural fluency, enabling your business to connect globally.
              </p>
            </div>
            <div className="flex flex-wrap gap-4 justify-center">
              {languages.map(lang => (
                <div key={lang.code} className="flex items-center gap-3 bg-[#676767]/40 backdrop-blur-sm border border-white/10 rounded-xl p-4 transition-transform hover:scale-105">
                  <Image src={lang.img} alt={`${lang.name} flag`} width={32} height={32} />
                  <h3 className="text-xl text-white font-medium">{lang.name}</h3>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </>
  );
}