import React from 'react'
import { NavLink, Link } from 'react-router-dom'
import { profile } from '../data/profile.js'

export default function Nav() {
  const [first, ...rest] = profile.name.split(' ')
  return (
    <header className="nav">
      <div className="container nav-inner">
        <Link to="/" className="nav-name" aria-label={`${profile.name} — home`}>
          {first} <span>{rest.join(' ')}</span>
        </Link>
        <nav className="nav-links" aria-label="Main">
          <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : '')}>
            Work
          </NavLink>
          <NavLink to="/about" className={({ isActive }) => (isActive ? 'active' : '')}>
            About
          </NavLink>
          <NavLink to="/resume" className={({ isActive }) => (isActive ? 'active' : '')}>
            Resume
          </NavLink>
          <NavLink to="/contact" className={({ isActive }) => (isActive ? 'active' : '')}>
            Contact
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
