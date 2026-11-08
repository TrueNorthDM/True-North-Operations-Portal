import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/supabase/admin', () => ({ createUploadClient: () => ({}), createAdminClient: () => ({}) }))
vi.mock('./clocky-context', () => ({ db: () => ({}), loadDirectory: async () => [] }))

import { badReceipt, receiptKind } from './reimbursement-store'

const file = (bytes: number[] | string, type: string) =>
  new File([typeof bytes === 'string' ? bytes : new Uint8Array(bytes)], 'x', { type })

describe('reimbursement receipts are read by their bytes (security audit, 6 November 2026)', () => {
  it('knows a PDF, a JPEG and a PNG whatever the browser called them', async () => {
    expect(await receiptKind(file('%PDF-1.7 rest', 'image/png'))).toEqual({ type: 'application/pdf', ext: 'pdf' })
    expect(await receiptKind(file([0xff, 0xd8, 0xff, 0xe0, 0, 0], 'application/pdf'))).toEqual({ type: 'image/jpeg', ext: 'jpg' })
    expect(await receiptKind(file([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0], 'image/png'))).toEqual({ type: 'image/png', ext: 'png' })
  })
  it('refuses HTML or a script sent as an image, naming the receipt', async () => {
    expect(await receiptKind(file('<html><script>alert(1)</script>', 'image/png'))).toBeNull()
    expect(await badReceipt([{ file: file('%PDF-1.4', 'application/pdf') }, { file: null }, { file: file('<svg onload=x>', 'image/jpeg') }]))
      .toBe('Receipt 3: the file is not a photo (JPG, PNG, HEIC) or a PDF.')
    expect(await badReceipt([{ file: null }, { file: file('%PDF-1.4', 'application/pdf') }])).toBeNull()
  })
})
