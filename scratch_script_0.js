
    tailwind.config = {
      darkMode: 'class',
      theme: {
        extend: {
          colors: {
            brand: {
              white: '#F5F3EC',        // Warm Off-White
              cardBg: '#FFFFFF',       // Pure White
              lightGreen: '#E8EFEB',   // Soft Green Light BG
              green: '#123B32',        // Primary Dark Green
              secGreen: '#2F5B4E',     // Secondary Green
              accent: '#527A68',       // Accent Green
              copper: '#C47D4C',       // Warm Copper Accent
              darkText: '#1E292B',     // Charcoal Text
              secText: '#527A68',      // Muted Secondary Text
              border: '#E2E8F0'        // Soft Slate Border
            }
          },
          fontFamily: {
            sans: ['Inter', 'sans-serif'],
            heading: ['Outfit', 'sans-serif'],
            mono: ['Fira Code', 'monospace']
          }
        }
      }
    }
  