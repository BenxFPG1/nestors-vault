"use client";

/**
 * Eén klik in je favorietenbalk. Er gaat bewust géén sleutel in de
 * bookmarklet: het venster dat opent is gewoon je vault, en die herkent je
 * aan de cookie die er al is. Zo staat je sleutel nergens in een bladwijzer
 * die je per ongeluk deelt of synchroniseert.
 */
export default function Bookmarklet({ basis }: { basis: string }) {
  const code =
    `javascript:(function(){window.open('${basis}/toevoegen?url='+` +
    `encodeURIComponent(location.href)+'&titel='+encodeURIComponent(document.title.slice(0,120)),` +
    `'vault','width=460,height=640');})();`;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={code}
          onClick={(event) => event.preventDefault()}
          draggable
          title="Sleep mij naar je favorietenbalk"
          className="cursor-grab rounded-xl bg-chalk px-5 py-3 text-sm font-medium text-ink active:cursor-grabbing"
        >
          + Vault
        </a>
        <span className="text-xs text-mute">← sleep deze knop naar je favorietenbalk</span>
      </div>

      <details className="rounded-xl border border-line bg-surface p-3">
        <summary className="cursor-pointer text-xs text-mute">
          Lukt slepen niet? Kopieer de code
        </summary>
        <textarea
          readOnly
          value={code}
          onFocus={(event) => event.currentTarget.select()}
          rows={3}
          className="mt-2 w-full resize-none rounded-lg border border-line bg-ink p-2 font-mono text-[10px] text-mute outline-none"
        />
        <p className="mt-2 text-[11px] leading-relaxed text-mute">
          Maak een nieuwe bladwijzer, geef hem de naam Vault, en plak dit als adres.
        </p>
      </details>
    </div>
  );
}
