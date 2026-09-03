with open("pages/index.js", "r", encoding="utf-8") as f:
    content = f.read()

replacements = [
    ("// redirect penuh ke Stripe Checkout", "// redirect penuh ke Billplz"),
    ("gerbang pembayaran Stripe (Kad/FPX)", "gerbang pembayaran Billplz (Kad/FPX)"),
    ("halaman pembayaran selamat Stripe.", "halaman pembayaran selamat Billplz."),
]

total = 0
for old, new in replacements:
    count = content.count(old)
    print(f">>> '{old[:50]}...' -> dijumpai {count} kali")
    if count == 0:
        print(f">>> AMARAN: tiada padanan untuk '{old}'. Dilangkau.")
        continue
    content = content.replace(old, new)
    total += count

if total == 0:
    raise SystemExit(">>> RALAT: Tiada satu pun padanan dijumpai. Tiada apa-apa diubah.")

with open("pages/index.js", "w", encoding="utf-8") as f:
    f.write(content)

print(f">>> Berjaya! {total} tempat dikemas kini daripada Stripe -> Billplz.")