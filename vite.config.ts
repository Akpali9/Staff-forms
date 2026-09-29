import { defineConfig, type HtmlTagDescriptor, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

type FigmaSiteConfiguration = {
  title?: string
  description?: string
  language?: string
  robots?: {
    index?: boolean
  }
  icons?: {
    icon?: string
  }
  openGraph?: {
    image?: string
  }
  analytics?: {
    googleAnalyticsId?: string
  }
  customScripts?: {
    headStart?: string
    headEnd?: string
    bodyStart?: string
    bodyEnd?: string
  }
  accessibility?: {
    addBypassLinks?: boolean
  }
}

const siteConfiguration: FigmaSiteConfiguration = {
  title: 'Your Website',
  description: 'Your website description',
  language: 'en',
  robots: {
    index: true,
  },
}

function figmaSiteConfiguration(config: FigmaSiteConfiguration): Plugin {
  // keep your existing function body here
}
