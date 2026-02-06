'use client'

import { LogOut, BellOff, KeyRound, Calendar } from 'lucide-react'
import { Button, Modal } from '@heroui/react'

interface LogoutModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  isLoading?: boolean
}

export function LogoutModal({ isOpen, onClose, onConfirm, isLoading }: LogoutModalProps) {
  return (
    <Modal>
      <Modal.Backdrop
        variant="blur"
        isOpen={isOpen}
        onOpenChange={(open) => !open && onClose()}
        isDismissable={!isLoading}
        isKeyboardDismissDisabled={isLoading}
        className="z-[100]"
      >
        <Modal.Container placement="center" size="sm">
          <Modal.Dialog className="bg-background-darker border border-white/10 rounded-2xl">
            <Modal.CloseTrigger className="text-foreground-muted hover:text-foreground-light" />
            
            <Modal.Header className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <LogOut size={20} className="text-red-400" />
              </div>
              <Modal.Heading className="text-lg font-medium text-foreground-light">התנתקות</Modal.Heading>
            </Modal.Header>
            
            <Modal.Body>
              <p className="text-foreground-muted mb-4">
                האם אתה בטוח שברצונך להתנתק?
              </p>
              
              <div className="space-y-3">
                <div className="flex items-start gap-3 text-sm">
                  <BellOff size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-foreground-muted">
                    <span className="text-amber-400">לא תקבל התראות</span> על תורים קרובים, שינויים או עדכונים
                  </p>
                </div>
                
                <div className="flex items-start gap-3 text-sm">
                  <Calendar size={16} className="text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-foreground-muted">
                    <span className="text-amber-400">לא תוכל לקבוע תורים</span> עד שתתחבר מחדש
                  </p>
                </div>
                
                <div className="flex items-start gap-3 text-sm">
                  <KeyRound size={16} className="text-foreground-muted mt-0.5 flex-shrink-0" />
                  <p className="text-foreground-muted">
                    להתחברות מחדש יידרש <span className="text-foreground-light">אימות SMS</span> עם קוד חד-פעמי
                  </p>
                </div>
              </div>
            </Modal.Body>
            
            <Modal.Footer className="flex gap-3">
              <Button
                variant="secondary"
                slot="close"
                isDisabled={isLoading}
                className="flex-1"
              >
                ביטול
              </Button>
              <Button
                variant="danger"
                onPress={onConfirm}
                isDisabled={isLoading}
                className="flex-1"
              >
                <LogOut size={18} />
                <span>התנתק</span>
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  )
}

