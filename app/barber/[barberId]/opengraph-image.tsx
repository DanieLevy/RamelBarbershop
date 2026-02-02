import { ImageResponse } from 'next/og'
import { createClient } from '@/lib/supabase/server'
import { generateSlugFromEnglishName, isValidUUID } from '@/lib/utils'

// Image dimensions for social media (WhatsApp, Facebook, etc.)
export const size = {
  width: 1200,
  height: 630,
}

export const contentType = 'image/png'

// Alt text for accessibility
export const alt = 'רם אל ברברשופ - קביעת תור'

interface Props {
  params: Promise<{ barberId: string }>
}

/**
 * Dynamic Open Graph image for barber profiles
 * Shows the barber's profile picture in WhatsApp/social media link previews
 */
export default async function Image({ params }: Props) {
  const { barberId } = await params
  const supabase = await createClient()
  const slugLower = barberId.toLowerCase()
  
  // Find barber by UUID, English name slug, or username
  let barber = null
  const isUuidLookup = isValidUUID(barberId)
  
  if (isUuidLookup) {
    const { data } = await supabase
      .from('users')
      .select('id, fullname, img_url, name_en, username')
      .eq('is_barber', true)
      .eq('id', barberId)
      .single()
    barber = data
  } else {
    // Look for barber by name_en slug or username
    const { data: allBarbers } = await supabase
      .from('users')
      .select('id, fullname, img_url, name_en, username')
      .eq('is_barber', true)
    
    if (allBarbers) {
      // First try matching by English name slug
      for (const b of allBarbers) {
        if (b.name_en) {
          const expectedSlug = generateSlugFromEnglishName(b.name_en)
          if (expectedSlug === slugLower) {
            barber = b
            break
          }
        }
      }
      
      // Fall back to username
      if (!barber) {
        barber = allBarbers.find(
          b => b.username?.toLowerCase() === slugLower
        )
      }
    }
  }
  
  // Default values if barber not found
  const barberName = barber?.fullname || 'רם אל ברברשופ'
  const barberImage = barber?.img_url || null
  
  return new ImageResponse(
    (
      <div
        style={{
          height: '100%',
          width: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(135deg, #1a1a1a 0%, #0a0a0a 100%)',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Gold accent line at top */}
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 6,
            background: 'linear-gradient(90deg, transparent, #d4a853, transparent)',
          }}
        />
        
        {/* Main content container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 30,
          }}
        >
          {/* Barber profile picture */}
          {barberImage ? (
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: '50%',
                overflow: 'hidden',
                border: '4px solid #d4a853',
                boxShadow: '0 0 40px rgba(212, 168, 83, 0.3)',
                display: 'flex',
              }}
            >
              <img
                src={barberImage}
                alt={barberName}
                width={200}
                height={200}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            </div>
          ) : (
            // Default icon if no image
            <div
              style={{
                width: 200,
                height: 200,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #2a2a2a, #1a1a1a)',
                border: '4px solid #d4a853',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg
                width="100"
                height="100"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#d4a853"
                strokeWidth="1.5"
              >
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
          )}
          
          {/* Barber name */}
          <div
            style={{
              fontSize: 48,
              fontWeight: 700,
              color: '#ffffff',
              textAlign: 'center',
              maxWidth: 900,
            }}
          >
            {barberName}
          </div>
          
          {/* Call to action */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '16px 32px',
              background: 'linear-gradient(135deg, #d4a853, #b8934a)',
              borderRadius: 50,
              color: '#0a0a0a',
              fontSize: 24,
              fontWeight: 600,
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            קבע תור עכשיו
          </div>
        </div>
        
        {/* Shop name at bottom */}
        <div
          style={{
            position: 'absolute',
            bottom: 30,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            color: 'rgba(255, 255, 255, 0.6)',
            fontSize: 20,
          }}
        >
          רם אל ברברשופ • Ramel Barbershop
        </div>
        
        {/* Corner accents */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            left: 20,
            width: 40,
            height: 40,
            borderTop: '3px solid rgba(212, 168, 83, 0.5)',
            borderLeft: '3px solid rgba(212, 168, 83, 0.5)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: 20,
            width: 40,
            height: 40,
            borderTop: '3px solid rgba(212, 168, 83, 0.5)',
            borderRight: '3px solid rgba(212, 168, 83, 0.5)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            left: 20,
            width: 40,
            height: 40,
            borderBottom: '3px solid rgba(212, 168, 83, 0.5)',
            borderLeft: '3px solid rgba(212, 168, 83, 0.5)',
          }}
        />
        <div
          style={{
            position: 'absolute',
            bottom: 20,
            right: 20,
            width: 40,
            height: 40,
            borderBottom: '3px solid rgba(212, 168, 83, 0.5)',
            borderRight: '3px solid rgba(212, 168, 83, 0.5)',
          }}
        />
      </div>
    ),
    {
      ...size,
    }
  )
}
