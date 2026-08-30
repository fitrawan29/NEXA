---
description: Aturan wajib untuk selalu mem-push perubahan kode ke GitHub.
---

# Auto Git Push

Selalu ingat aturan berikut saat bekerja di repositori NEXA:
1. Setiap kali Anda (sebagai AI) selesai melakukan satu set perubahan (seperti refactoring, menambah fitur, memperbaiki bug), Anda **DIWAJIBKAN** untuk langsung melakukan `git add`, `git commit -m "[pesan_deskriptif]"`, dan `git push` tanpa harus diminta oleh *user*.
2. Jika beroperasi di Windows Powershell, gunakan pemisah command `;` (contoh: `git add . ; git commit -m "update" ; git push`), BUKAN `&&`.
