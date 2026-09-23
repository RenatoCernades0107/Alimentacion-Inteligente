"use client";

/** Campo oculto con la zona horaria del dispositivo. */
export function TimezoneInput() {
  return (
    <input
      type="hidden"
      name="timezone"
      ref={(el) => {
        if (el) el.value = Intl.DateTimeFormat().resolvedOptions().timeZone;
      }}
    />
  );
}
