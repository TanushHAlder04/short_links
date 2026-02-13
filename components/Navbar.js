'use client'
import React from 'react'
import Link from 'next/link'
import { useState } from 'react';
import { useSession, signOut } from 'next-auth/react';

const Navbar = () => {

  const [isOpen, setIsOpen] = useState(false);
  const { data: session } = useSession();

  return (
    <nav className='h-16 bg-teal-700 flex justify-between px-3 items-center text-white relative'>
      <div className="logo font-bold text-2xl"> 
        <Link href="/">ShortLinks</Link>
      </div>

      {/*  Menu Button */}
      <button 
        className='md:hidden flex flex-col gap-1.5 z-50'
        onClick={() => setIsOpen(!isOpen)}
      >
        <span className={`w-6 h-0.5 bg-white transition-all duration-300 ${isOpen ? 'rotate-45 translate-y-2' : ''}`}></span>
        <span className={`w-6 h-0.5 bg-white transition-all duration-300 ${isOpen ? 'opacity-0' : ''}`}></span>
        <span className={`w-6 h-0.5 bg-white transition-all duration-300 ${isOpen ? '-rotate-45 -translate-y-2' : ''}`}></span>
      </button>

      {/* Nav Links */}
      <ul className={`
        flex flex-col md:flex-row justify-center gap-4 items-center
        md:static absolute top-16 left-0 w-full md:w-auto
        bg-teal-700 md:bg-transparent
        transition-all duration-300 ease-in-out
        ${isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full md:translate-x-0 opacity-0 md:opacity-100'}
        py-6 md:py-0
      `}>
        <Link href="/" onClick={() => setIsOpen(false)}><li>Home</li></Link>
        <Link href="/#about" onClick={() => setIsOpen(false)}><li>About</li></Link>
        <li className='flex flex-col md:flex-row gap-3 items-center'>
          <Link href="/shorten" onClick={() => setIsOpen(false)}>
            <button className='bg-emerald-500 rounded-lg shadow-lg p-3 py-1 font-bold'>Try Now</button>
          </Link>
          
          {session ? (
            <div className="flex items-center gap-3">
              <span className="text-sm">Hi, {session.user.name}</span>
              <button
                onClick={() => signOut()}
                className='bg-emerald-500 rounded-lg shadow-lg p-3 py-1 font-bold'
              >
                Logout
              </button>
            </div>
          ) : (
            <Link href="/login" onClick={() => setIsOpen(false)}>
              <button className='bg-emerald-500 rounded-lg shadow-lg p-3 py-1 font-bold'>Login</button>
            </Link>
          )}
        </li>
      </ul>
    </nav>
  )
}

export default Navbar