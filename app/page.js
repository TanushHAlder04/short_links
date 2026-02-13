import Image from "next/image";
import localFont from "next/font/local";
import Link from "next/link";
import { Zap } from 'lucide-react'

const poppins = localFont({
  src: "./fonts/Poppins-ExtraBold.ttf",
  variable: "--font-poppins",
  weight: "100 900",
});

export default function Home() {
  return (
    <main className="bg-teal-50">
      <section className="grid grid-cols-1 md:grid-cols-2 min-h-[50vh] gap-8 p-6 md:p-0">
        <div className="flex flex-col gap-4 items-center justify-center order-2 md:order-1">
          <p className={`text-2xl md:text-3xl lg:text-4xl font-bold ${poppins.className} text-center px-4`}>
            URL SHORTNER , MAKE IT SHORT , MAKE IT SNAPY
          </p>
          <p className="px-4 md:px-20 lg:px-56 text-center text-sm md:text-base">
            The Most Easy To Use URL Shortener , Simplifying The Internet Through the power of the URL . Transform Your lengthy URLs into clean, trackable links in one click. No sign-up needed.
          </p>
          <div className='flex flex-col sm:flex-row gap-3 justify-center w-full px-4 sm:w-auto'>
            <Link href="/shorten" className="w-full sm:w-auto">
              <button className='bg-emerald-500 rounded-lg shadow-lg p-3 py-2 font-bold text-white w-full sm:w-auto'>Try Now</button>
            </Link>
            <Link href="/login" className="w-full sm:w-auto">
              <button className='bg-emerald-500 rounded-lg shadow-lg p-3 py-2 font-bold text-white w-full sm:w-auto'>Login</button>
            </Link>
          </div>
        </div>
        <div className="flex justify-center items-center relative h-64 md:h-auto order-1 md:order-2">
          <Image 
            className="mix-blend-darken object-contain" 
            alt="an Image of a vector" 
            src={"/vector.jpg"} 
            fill={true}
          />
        </div>
      </section>
      
      {/* About Section */}
      <section id="about" className="max-w-2xl mx-auto mt-12 md:mt-24 text-center px-4 py-12">
        <h2 className="text-2xl md:text-3xl font-bold mb-4">Why We're Different</h2>
        <p className="text-gray-600 mb-8 text-sm md:text-base">
          We believe link shortening should be instant, private, and free. No forced sign-ups, no invasive tracking—just clean, fast links.
        </p>
        <div className="backdrop-blur-md bg-white/10 border border-white/20 rounded-xl p-6 md:p-8 text-left space-y-4">
          {[
            "No forced registration—ever",
            "Privacy-focused with zero tracking by default",
            "Lightning-fast shortening under 100ms",
            "Clean, memorable short URLs",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center shrink-0 mt-0.5">
                <Zap className="w-3 h-3 text-emerald-500" />
              </div>
              <span className="text-sm md:text-base">{item}</span>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}