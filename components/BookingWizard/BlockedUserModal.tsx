'use client'

import { useRouter } from 'next/navigation'
import { AlertCircle, Home } from 'lucide-react'
import { Button, Modal } from '@heroui/react'

interface BlockedUserModalProps {
  isOpen: boolean
}

export function BlockedUserModal({ isOpen }: BlockedUserModalProps) {
  const router = useRouter()

  return (
    <Modal>
      <Modal.Backdrop
        variant="blur"
        isOpen={isOpen}
        isDismissable={false}
        isKeyboardDismissDisabled={true}
        className="z-50"
      >
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog className="bg-background-card border border-white/10 rounded-2xl text-center">
            <Modal.Header className="flex flex-col items-center justify-center">
              <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mb-4">
                <AlertCircle size={32} className="text-red-400" />
              </div>
              <Modal.Heading className="text-xl font-medium text-foreground-light">
                לא ניתן לבצע הזמנה
              </Modal.Heading>
            </Modal.Header>
            
            <Modal.Body>
              <p className="text-foreground-muted">
                לא ניתן לבצע הזמנה כרגע.
                <br />
                אנא פנה לצוות הברברשופ לקבלת מידע נוסף.
              </p>
            </Modal.Body>
            
            <Modal.Footer className="justify-center">
              <Button
                variant="primary"
                onPress={() => router.push('/')}
                className="w-full"
              >
                <Home size={18} />
                חזרה לדף הבית
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

