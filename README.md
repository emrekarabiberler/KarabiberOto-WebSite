# KarabiberOto Web

Bu klasor mobil uygulamadaki ana akislari webde denemek icin eklendi.

- Giris / kayit: `/auth/login`, `/auth/register`, `/auth/me`
- Katalog: `/products`, `/products/categories`
- Sepet: tarayicida local state olarak calisir
- Barkod sorgu: `/products/barcode/{barcode}`
- AI renk onizleme: `/ai/recolor-car`

Backend calisirken web arayuzu su adresten servis edilir:

```bash
http://localhost:8000/web
```

Dosyayi dogrudan tarayicida acmak da mumkun, ancak backend adresinin erisilebilir olmasi gerekir. Sol alttaki API adresi alani varsayilan production backend adresiyle gelir; lokal backend kullanacaksaniz `http://localhost:8000` olarak kaydedin.
