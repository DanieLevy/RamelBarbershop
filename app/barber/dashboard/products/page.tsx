'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useBarberAuthStore } from '@/store/useBarberAuthStore'
import { createClient } from '@/lib/supabase/client'
import { uploadProductImage, deleteProductImage } from '@/lib/storage/upload'
import { toast } from 'sonner'
import { cn, formatPrice } from '@/lib/utils'
import { useBugReporter } from '@/hooks/useBugReporter'
import { 
  Plus, 
  Pencil, 
  Trash2, 
  Package, 
  X, 
  Upload, 
  Eye, 
  EyeOff,
  GripVertical,
  ImageIcon,
} from 'lucide-react'
import Image from 'next/image'
import type { Product } from '@/types/database'

export default function ProductsPage() {
  const router = useRouter()
  const { isAdmin } = useBarberAuthStore()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const { report } = useBugReporter('ProductsPage')
  
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    name: '',
    name_he: '',
    description: '',
    price: '',
    image_url: '',
    is_active: true,
  })
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)

  const fetchProducts = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .order('display_order', { ascending: true })
      
      if (error) throw error
      setProducts((data as Product[]) || [])
    } catch (error) {
      console.error('Error fetching products:', error)
      await report(error, 'Fetching products list')
      toast.error('שגיאה בטעינת המוצרים')
    } finally {
      setLoading(false)
    }
  }, [report])

  useEffect(() => {
    if (!isAdmin) {
      router.replace('/barber/dashboard')
      return
    }
    fetchProducts()
  }, [isAdmin, router, fetchProducts])

  const resetForm = () => {
    setFormData({
      name: '',
      name_he: '',
      description: '',
      price: '',
      image_url: '',
      is_active: true,
    })
    setPreviewImage(null)
    setSelectedFile(null)
    setEditingProduct(null)
    setShowForm(false)
  }

  const handleEdit = (product: Product) => {
    setEditingProduct(product)
    setFormData({
      name: product.name,
      name_he: product.name_he,
      description: product.description || '',
      price: product.price.toString(),
      image_url: product.image_url || '',
      is_active: product.is_active ?? true,
    })
    setPreviewImage(product.image_url || null)
    setShowForm(true)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    
    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
    if (!allowedTypes.includes(file.type)) {
      toast.error('סוג קובץ לא נתמך. יש להעלות תמונה בפורמט JPEG, PNG או WebP.')
      return
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('גודל הקובץ חייב להיות עד 5MB')
      return
    }
    
    setSelectedFile(file)
    setPreviewImage(URL.createObjectURL(file))
  }

  const handleSubmit = async () => {
    if (!formData.name_he.trim() || !formData.price) {
      toast.error('נא למלא שם ומחיר')
      return
    }
    
    const price = parseFloat(formData.price)
    if (isNaN(price) || price <= 0) {
      toast.error('נא להזין מחיר תקין')
      return
    }
    
    setSaving(true)
    
    try {
      const supabase = createClient()
      let imageUrl = formData.image_url
      
      // Upload new image if selected
      if (selectedFile) {
        setUploading(true)
        const productId = editingProduct?.id || `temp_${Date.now()}`
        const uploadResult = await uploadProductImage(selectedFile, productId)
        
        if (!uploadResult.success) {
          toast.error(uploadResult.error || 'שגיאה בהעלאת התמונה')
          setSaving(false)
          setUploading(false)
          return
        }
        
        imageUrl = uploadResult.url || ''
        setUploading(false)
      }
      
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const db = supabase as any
      
      if (editingProduct) {
        // Update existing product
        const { error } = await db
          .from('products')
          .update({
            name: formData.name || formData.name_he,
            name_he: formData.name_he,
            description: formData.description || null,
            price,
            image_url: imageUrl || null,
            is_active: formData.is_active,
            updated_at: new Date().toISOString(),
          })
          .eq('id', editingProduct.id)
        
        if (error) throw error
        toast.success('המוצר עודכן בהצלחה!')
      } else {
        // Create new product
        const { error } = await db
          .from('products')
          .insert({
            name: formData.name || formData.name_he,
            name_he: formData.name_he,
            description: formData.description || null,
            price,
            image_url: imageUrl || null,
            is_active: formData.is_active,
            display_order: products.length,
          })
        
        if (error) throw error
        toast.success('המוצר נוסף בהצלחה!')
      }
      
      resetForm()
      fetchProducts()
    } catch (error) {
      console.error('Error saving product:', error)
      await report(error, 'Saving product')
      toast.error('שגיאה בשמירת המוצר')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (product: Product) => {
    if (!confirm(`האם למחוק את "${product.name_he}"?`)) return
    
    try {
      const supabase = createClient()
      
      // Delete image from storage if exists
      if (product.image_url) {
        // Extract path from URL
        const urlParts = product.image_url.split('/products/')
        if (urlParts[1]) {
          await deleteProductImage(urlParts[1])
        }
      }
      
      const { error } = await supabase
        .from('products')
        .delete()
        .eq('id', product.id)
      
      if (error) throw error
      
      toast.success('המוצר נמחק בהצלחה')
      fetchProducts()
    } catch (error) {
      console.error('Error deleting product:', error)
      await report(error, 'Deleting product')
      toast.error('שגיאה במחיקת המוצר')
    }
  }

  const handleToggleActive = async (product: Product) => {
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from('products')
        .update({ is_active: !product.is_active })
        .eq('id', product.id)
      
      if (error) throw error
      
      toast.success(product.is_active ? 'המוצר הוסתר' : 'המוצר הופעל')
      fetchProducts()
    } catch (error) {
      console.error('Error toggling product:', error)
      await report(error, 'Toggling product visibility')
      toast.error('שגיאה בעדכון המוצר')
    }
  }

  if (!isAdmin) return null

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-medium text-foreground-light">ניהול מוצרים</h1>
          <p className="text-foreground-muted mt-1">הוסף ונהל את המוצרים שנמכרים במספרה</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(true) }}
          className="flex items-center gap-2 px-4 py-2 bg-accent-gold text-background-dark rounded-lg font-medium hover:bg-accent-gold/90 transition-colors"
        >
          <Plus size={16} strokeWidth={1.5} />
          הוסף מוצר
        </button>
      </div>

      {/* Add/Edit Form */}
      {showForm && (
        <div className="bg-background-card border border-white/10 rounded-2xl p-4 sm:p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-medium text-foreground-light">
              {editingProduct ? 'עריכת מוצר' : 'מוצר חדש'}
            </h3>
            <button
              onClick={resetForm}
              className="p-2 text-foreground-muted hover:text-foreground-light transition-colors"
            >
              <X size={20} strokeWidth={1.5} />
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            {/* Image Upload */}
            <div className="sm:col-span-2">
              <label className="text-foreground-light text-sm block mb-2">תמונה</label>
              <div className="flex items-start gap-4">
                {/* Preview */}
                <div 
                  className={cn(
                    'w-24 h-24 rounded-xl overflow-hidden bg-background-dark border border-white/10 flex items-center justify-center',
                    !previewImage && 'cursor-pointer hover:border-accent-gold/30'
                  )}
                  onClick={() => !previewImage && fileInputRef.current?.click()}
                >
                  {previewImage ? (
                    <Image
                      src={previewImage}
                      alt="Preview"
                      width={96}
                      height={96}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <ImageIcon size={24} strokeWidth={1.5} className="text-foreground-muted" />
                  )}
                </div>
                
                <div className="flex-1">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 border border-white/10 text-foreground-light hover:bg-white/10 transition-colors text-sm"
                  >
                    <Upload size={14} strokeWidth={1.5} />
                    {previewImage ? 'שנה תמונה' : 'העלה תמונה'}
                  </button>
                  <p className="text-xs text-foreground-muted mt-2">
                    JPEG, PNG או WebP עד 5MB
                  </p>
                  {previewImage && (
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewImage(null)
                        setSelectedFile(null)
                        setFormData({ ...formData, image_url: '' })
                      }}
                      className="text-xs text-red-400 hover:text-red-300 mt-1"
                    >
                      הסר תמונה
                    </button>
                  )}
                </div>
              </div>
            </div>
            
            {/* Name Hebrew */}
            <div className="flex flex-col gap-2">
              <label className="text-foreground-light text-sm">שם המוצר *</label>
              <input
                type="text"
                value={formData.name_he}
                onChange={(e) => setFormData({ ...formData, name_he: e.target.value })}
                placeholder="לדוגמה: שמן לזקן"
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold"
              />
            </div>
            
            {/* Price */}
            <div className="flex flex-col gap-2">
              <label className="text-foreground-light text-sm">מחיר (₪) *</label>
              <input
                type="number"
                dir="ltr"
                min="0"
                step="0.01"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                placeholder="49.90"
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold text-left"
              />
            </div>
            
            {/* Description */}
            <div className="sm:col-span-2 flex flex-col gap-2">
              <label className="text-foreground-light text-sm">תיאור (אופציונלי)</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="תיאור קצר של המוצר..."
                rows={2}
                className="w-full p-3 rounded-xl bg-background-dark border border-white/10 text-foreground-light outline-none focus:ring-2 focus:ring-accent-gold resize-none"
              />
            </div>
            
            {/* Active Toggle */}
            <div className="sm:col-span-2 flex items-center gap-3">
              <button
                type="button"
                onClick={() => setFormData({ ...formData, is_active: !formData.is_active })}
                className={cn(
                  'w-12 h-6 rounded-full transition-colors relative',
                  formData.is_active ? 'bg-accent-gold' : 'bg-white/20'
                )}
              >
                <div 
                  className={cn(
                    'absolute top-1 w-4 h-4 rounded-full bg-white transition-all',
                    formData.is_active ? 'right-1' : 'right-7'
                  )} 
                />
              </button>
              <span className="text-foreground-light text-sm">
                {formData.is_active ? 'מוצר פעיל - יוצג בקטלוג' : 'מוצר מוסתר'}
              </span>
            </div>
          </div>

          <div className="flex gap-3">
            <button
              onClick={handleSubmit}
              disabled={saving}
              className={cn(
                'flex-1 py-3 rounded-xl font-medium transition-all',
                saving
                  ? 'bg-foreground-muted/30 text-foreground-muted cursor-not-allowed'
                  : 'bg-accent-gold text-background-dark hover:bg-accent-gold/90'
              )}
            >
              {saving ? (uploading ? 'מעלה תמונה...' : 'שומר...') : editingProduct ? 'עדכן' : 'הוסף'}
            </button>
            <button
              onClick={resetForm}
              className="px-6 py-3 rounded-xl bg-background-dark border border-white/10 text-foreground-muted hover:text-foreground-light transition-colors"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      {/* Products List */}
      <div className="bg-background-card border border-white/10 rounded-2xl p-4 sm:p-6">
        {products.length === 0 ? (
          <div className="text-center py-12">
            <Package size={48} strokeWidth={1} className="text-foreground-muted/30 mx-auto mb-3" />
            <p className="text-foreground-muted">אין מוצרים במערכת</p>
            <p className="text-foreground-muted/50 text-sm mt-1">הוסף מוצר ראשון כדי להתחיל</p>
          </div>
        ) : (
          <div className="space-y-3">
            {products.map((product) => (
              <div
                key={product.id}
                className={cn(
                  'flex items-center gap-3 sm:gap-4 p-3 sm:p-4 rounded-xl border',
                  product.is_active
                    ? 'bg-background-dark border-white/5'
                    : 'bg-background-dark/50 border-white/5 opacity-60'
                )}
              >
                {/* Drag Handle */}
                <div className="hidden sm:flex items-center text-foreground-muted/30 cursor-grab">
                  <GripVertical size={16} strokeWidth={1.5} />
                </div>
                
                {/* Product Image */}
                <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-xl overflow-hidden bg-background-card flex-shrink-0">
                  {product.image_url ? (
                    <Image
                      src={product.image_url}
                      alt={product.name_he}
                      width={64}
                      height={64}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package size={20} strokeWidth={1.5} className="text-foreground-muted" />
                    </div>
                  )}
                </div>
                
                {/* Product Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-foreground-light font-medium text-sm sm:text-base truncate">
                      {product.name_he}
                    </p>
                    {!product.is_active && (
                      <span className="text-[10px] text-foreground-muted bg-white/10 px-1.5 py-0.5 rounded">
                        מוסתר
                      </span>
                    )}
                  </div>
                  <p className="text-accent-gold font-bold text-sm mt-0.5">
                    {formatPrice(product.price)}
                  </p>
                </div>
                
                {/* Actions */}
                <div className="flex items-center gap-1 sm:gap-2">
                  <button
                    onClick={() => handleToggleActive(product)}
                    className={cn(
                      'icon-btn p-2 rounded-lg transition-colors',
                      product.is_active
                        ? 'text-foreground-muted hover:text-yellow-400 hover:bg-yellow-400/10'
                        : 'text-foreground-muted hover:text-green-400 hover:bg-green-400/10'
                    )}
                    title={product.is_active ? 'הסתר' : 'הצג'}
                  >
                    {product.is_active ? (
                      <EyeOff size={16} strokeWidth={1.5} />
                    ) : (
                      <Eye size={16} strokeWidth={1.5} />
                    )}
                  </button>
                  <button
                    onClick={() => handleEdit(product)}
                    className="icon-btn p-2 text-foreground-muted hover:text-accent-gold hover:bg-accent-gold/10 rounded-lg transition-colors"
                    title="ערוך"
                  >
                    <Pencil size={16} strokeWidth={1.5} />
                  </button>
                  <button
                    onClick={() => handleDelete(product)}
                    className="p-2 text-foreground-muted hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                    title="מחק"
                  >
                    <Trash2 size={16} strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

