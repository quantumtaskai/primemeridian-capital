# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Prime Meridian Capital is a luxury investment advisory firm website built with vanilla HTML, CSS, and JavaScript. The site features a modern, premium design with black and gold color scheme, focusing on M&A advisory services and capital solutions.

## Architecture

This is a static website with:
- **index.html**: Single-page application with multiple sections (hero, services, about, leadership, contact)
- **styles.css**: Comprehensive CSS with design system using CSS custom properties
- **script.js**: Client-side JavaScript for interactions, form handling, and animations
- **Image assets**: Professional images referenced in images.md

### Key Components

1. **Navigation**: Fixed luxury navbar with mobile hamburger menu
2. **Hero Section**: Statistics display, floating cards animation, call-to-action buttons
3. **Services**: Three main service cards (M&A Advisory, Investment Advisory, Market Intelligence)
4. **Leadership**: Profile section for Purva Mehta (Founder & Managing Director)
5. **Contact Form**: Multi-field form with validation and submission handling

## Development Workflow

Since this is a static site with no build process:
- **Local Development**: Open index.html directly in browser or use a simple HTTP server
- **Testing**: Manual testing in browser, no automated test framework
- **Deployment**: Static file hosting (files can be served directly)

## Design System

The CSS uses a comprehensive design system with CSS custom properties in :root:
- **Colors**: Premium black and gold palette with sophisticated neutrals
- **Typography**: Playfair Display (headings) and Montserrat (body text) from Google Fonts  
- **Spacing**: Consistent spacing scale using CSS variables
- **Shadows**: Multiple shadow variants for depth and luxury feel

## JavaScript Functionality

Key interactive features:
- Mobile navigation toggle
- Smooth scrolling for anchor links
- Contact form validation and submission simulation
- Intersection Observer for scroll animations
- Button ripple effects
- Navbar background opacity on scroll

## Contact Information

The site displays contact information for:
- **Dubai Office**: +971 52312 9920
- **Email**: purva.mehta@primemeridian-capital.com
- **Global presence**: Dubai & London offices mentioned

## Content Structure

- **Services**: M&A Advisory, Capital Advisory, Business Growth & Market Intelligence
- **Statistics**: $2.4B+ transaction value, 25+ countries
- **Leadership**: Purva Mehta with 15+ years experience in M&A and investment advisory
- add these to to-dos for late