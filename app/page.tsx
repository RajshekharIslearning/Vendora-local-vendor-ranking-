"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

const MASTER_LOCALITIES = ["S G Highway", "Dholera", "Satellite", "Bopal", "Jagatpur", "Chandkheda", "Gota", "Prahlad Nagar", "Vastrapur", "Vaishno Devi", "Shela", "South Bopal", "Naranpura", "Bavla", "Bodakdev", "Maninagar", "Thaltej", "Pipali Highway", "Naroda", "Vejalpur", "Noblenagar", "Ghatlodia", "Ambawadi", "Motera", "Memnagar", "Ranip", "Vastral", "Navrangpura", "Gurukul", "Nikol", "S P Ring Road", "Shilaj", "Vasna", "Chandlodia", "Paldi", "Science City", "Sabarmati", "Ghodasar", "Juhapura", "New Ranip", "Narol", "Jivrajpark", "Bapunagar", "Tragad", "Nava Wadaj", "Shyamal", "Gokuldham", "Sanand", "Vatva", "Ashram road", "Dholka", "Sola", "Ghuma", "Jodhpur", "New CG Road", "Isanpur", "Shahibaug", "Thaltej Road", "Changodar", "Kankaria", "New Maninagar", "Saraspur", "Makarba", "Amraiwadi", "Odhav", "Palodia", "Sanand - Nalsarovar Road", "Nehrunagar", "Ramdev Nagar", "Sarkhej", "Ambli", "Kathwada", "Nirnay Nagar", "C G Road", "Sanathal", "Sughad", "Hathijan", "Manipur", "Chanakyapuri", "Shah E Alam Roja", "Nava Naroda", "Khokhra", "Saijpur Bogha", "Godhavi", "Mahadev Nagar", "Ellis Bridge", "Racharda", "Rakanpur", "Nasmed", "Jashoda Nagar", "Lambha", "Koteshwar", "Bagodara", "Lapkaman", "Anandnagar", "Kubernagar", "Sola Road", "Ognaj", "Bhadaj", "Shantipura", "Hansol", "Naroda road", "Narol Road", "Moraiya", "Behrampura", "Hatkeshwar", "Kalupur", "Meghani Nagar", "Barejadi", "kheda", "Khodiar Nagar", "Bhat", "Asarwa", "Chharodi", "Dhandhuka", "Khanpur", "Naroda GIDC", "Raipur", "Shahpur", "Thakkarbapa Nagar", "Usmanpura", "132 Feet Ring Road", "Sanand-Viramgam Road", "Ahmedabad-Rajkot-Highway", "Aslali", "Ayojan Nagar", "Bhadra", "Dani Limbada", "Dariapur", "Dudheshwar", "Girdhar Nagar", "Gomtipur", "Gulbai Tekra", "Jamalpur", "Juna Wadaj", "Kalapinagar", "Keshav Nagar", "Khadia", "Khamasa", "Madhupura", "Navjivan", "Raikhad", "Rakhial", "Sadar Bazar", "Vatva GIDC", "Viramgam", "Kali", "Santej", "Nandej", "Raska", "Laxmanpura", "Bavla Nalsarovar Road", "Unali", "Mandal", "D Colony", "Sardar Colony", "Kotarpur", "Mirzapur", "Narayan Nagar", "Kolat", "Purshottam Nagar", "Gita Mandir", "Sachana", "Vinzol", "Geratpur", "Sarangpur", "Acher", "Hebatpur", "Devdholera", "Lilapur", "Mahemdabad", "Vishala", "Ashok Vatika"];

const POPULAR_LOCALITIES = ["Vastrapur", "Prahlad Nagar", "Satellite", "Vastral", "Bopal", "Maninagar", "Amraiwadi", "C G Road", "Thaltej", "Navrangpura", "Gota", "Bodakdev"];

const FOOD_SYNONYMS: Record<string, string> = {
  golgappa: "panipuri",
  puchka: "panipuri",
  gupchup: "panipuri",
  bunmaska: "maskabun",
  muskabun: "maskabun",
  "lemon soda": "gotisoda",
  "aloo bonda": "batatavada",
  gota: "Bhajiya"
};

type Vendor = {
  id: string;
  name: string;
  address: string;
  locality: string;
  speciality?: string | null;
  score: number | null;
  add_attempt_count: number | null;
  rating_average?: number | null;
  rating_count?: number | null;
};

function parseSearchQuery(input: string): { keyword: string; locality: string } {
  const raw = input.trim();
  if (!raw) return { keyword: "", locality: "" };

  const separator = " in ";
  const idx = raw.toLowerCase().lastIndexOf(separator);

  if (idx === -1) {
    return { keyword: raw, locality: "" };
  }

  const keyword = raw.slice(0, idx).trim();
  const locality = raw.slice(idx + separator.length).trim();

  return {
    keyword,
    locality,
  };
}

function similarityScore(a: string, b: string): number {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();

  const makeBigrams = (str: string) => {
    const s = normalize(str);
    if (!s) return [] as string[];
    const compact = s.replace(/\s+/g, " ");
    const bigrams: string[] = [];
    for (let i = 0; i < compact.length - 1; i++) {
      bigrams.push(compact.slice(i, i + 2));
    }
    return bigrams;
  };

  const aBigrams = makeBigrams(a);
  const bBigrams = makeBigrams(b);

  if (!aBigrams.length || !bBigrams.length) return 0;

  const setB = new Set(bBigrams);
  let intersection = 0;

  for (const bg of aBigrams) {
    if (setB.has(bg)) intersection++;
  }

  return (2 * intersection) / (aBigrams.length + bBigrams.length);
}

function computeVendorSimilarity(keyword: string, vendor: Vendor): number {
  const base = similarityScore(keyword, vendor.name ?? "");

  if (!vendor.speciality) {
    return base;
  }

  const specs = vendor.speciality
    .split(",")
    .map((raw) => raw.trim())
    .filter(Boolean);

  const specScore = specs.reduce(
    (max, spec) => Math.max(max, similarityScore(keyword, spec)),
    0
  );

  return Math.max(base, specScore);
}

async function searchVendors(
  parsedKeyword: string,
  parsedLocality: string
): Promise<{ vendors: Vendor[]; keyword: string; locality: string }> {
  const keywordFilter = parsedKeyword.toLowerCase().trim();
  const synonymKeyword = keywordFilter
    ? FOOD_SYNONYMS[keywordFilter] ?? null
    : null;
  const localityFilter = parsedLocality.toLowerCase().trim();

  let query = supabase.from("vendors").select("*");

  if (localityFilter) {
    // Only treat this as a locality filter when user explicitly types " in "
    query = query.ilike("locality", `%${localityFilter}%`);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  let results = (data as Vendor[]) ?? [];
  let effectiveKeyword = parsedKeyword;
  let effectiveLocality = parsedLocality;

  if (keywordFilter) {
    // Fuzzy match against name and speciality
    const withScores = results.map((vendor) => ({
      vendor,
      similarity: Math.max(
        computeVendorSimilarity(keywordFilter, vendor),
        synonymKeyword
          ? computeVendorSimilarity(synonymKeyword, vendor)
          : 0
      ),
    }));

    withScores.sort((a, b) => {
      if (b.similarity !== a.similarity) {
        return b.similarity - a.similarity;
      }
      return (b.vendor.score ?? 0) - (a.vendor.score ?? 0);
    });

    const SIMILARITY_THRESHOLD = 0.3;
    const matched = withScores.filter(
      (entry) => entry.similarity >= SIMILARITY_THRESHOLD
    );

    if (matched.length > 0) {
      results = matched.map((entry) => entry.vendor);
    } else {
      // Locality fallback: if keyword perfectly matches a locality,
      // show top-rated shops in that area.
      const { data: localityData, error: localityError } = await supabase
        .from("vendors")
        .select("*")
        .ilike("locality", keywordFilter);

      if (localityError) {
        throw localityError;
      }

      const localityVendors =
        (localityData as Vendor[] | null)?.filter(
          (vendor) => vendor.locality.toLowerCase().trim() === keywordFilter
        ) ?? [];

      if (localityVendors.length > 0) {
        localityVendors.sort(
          (a, b) => (b.score ?? 0) - (a.score ?? 0)
        );
        results = localityVendors;
        effectiveKeyword = "";
        effectiveLocality = localityVendors[0].locality;
      } else {
        results = [];
      }
    }
  } else {
    // Pure locality or global search: just sort by score
    results.sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
  }

  return {
    vendors: results,
    keyword: effectiveKeyword,
    locality: effectiveLocality,
  };
}

export default function Home() {
  const [searchInput, setSearchInput] = useState("");
  const [keyword, setKeyword] = useState("");
  const [locality, setLocality] = useState("");
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  const [isAddOpen, setIsAddOpen] = useState(false);
  const [addName, setAddName] = useState("");
  const [addAddress, setAddAddress] = useState("");
  const [addLocality, setAddLocality] = useState("");
  const [addSpeciality, setAddSpeciality] = useState("");
  const [isSavingVendor, setIsSavingVendor] = useState(false);
  const [addMessage, setAddMessage] = useState<string | null>(null);

  const [selectedRatings, setSelectedRatings] = useState<Record<string, number>>(
    {}
  );
  const [ratingLoading, setRatingLoading] = useState<Record<string, boolean>>(
    {}
  );
  const [ratingErrors, setRatingErrors] = useState<
    Record<string, string | null>
  >({});

  const [toast, setToast] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isAdminModalOpen, setIsAdminModalOpen] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [adminError, setAdminError] = useState<string | null>(null);

  const isAddFormValid =
    addName.trim().length > 0 &&
    addAddress.trim().length > 0 &&
    addLocality.trim().length > 0 &&
    MASTER_LOCALITIES.some((loc) => loc.toLowerCase() === addLocality.trim().toLowerCase()) &&
    addSpeciality.trim().length > 0;

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setSearchError(null);

    const { keyword: parsedKeyword, locality: parsedLocality } =
      parseSearchQuery(searchInput);

    if (!parsedKeyword && !parsedLocality) {
      setSearchError("Please enter what you're looking for or a locality.");
      return;
    }

    setIsSearching(true);

    try {
      const {
        vendors: found,
        keyword: finalKeyword,
        locality: finalLocality,
      } = await searchVendors(parsedKeyword, parsedLocality);

      setKeyword(finalKeyword);
      setLocality(finalLocality);
      setVendors(found);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to fetch vendors.";
      setSearchError(message);
      setVendors([]);
    } finally {
      setIsSearching(false);
    }
  }

  function openAddModal() {
    setAddLocality(locality || "");
    setAddName("");
    setAddAddress("");
    setAddSpeciality("");
    setAddMessage(null);
    setIsAddOpen(true);
  }

  async function handleSaveVendor(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingVendor(true);
    setAddMessage(null);

    const rawName = addName.trim();
    const rawAddress = addAddress.trim();
    const rawLoc = addLocality.trim();
    const rawSpeciality = addSpeciality.trim();

    if (!rawName || !rawAddress || !rawLoc || !rawSpeciality) {
      setAddMessage("Name, address, locality, and speciality are required.");
      setIsSavingVendor(false);
      return;
    }

    try {
      const { data: existing, error: lookupError } = await supabase
        .from("vendors")
        .select("id, add_attempt_count, rating_average, speciality")
        .eq("name", rawName)
        .eq("locality", rawLoc)
        .maybeSingle();

      if (lookupError) {
        throw lookupError;
      }

      if (existing) {
        const currentCount = existing.add_attempt_count ?? 0;
        const nextCount = currentCount + 1;
        const ratingAverage = existing.rating_average ?? 0;
        const nextScore =
          ratingAverage * 10 + Math.log10(nextCount + 1) * 5;
        const { error: updateError } = await supabase
          .from("vendors")
          .update({
            add_attempt_count: nextCount,
            speciality: rawSpeciality || existing.speciality,
            score: nextScore,
          })
          .eq("id", existing.id);

        if (updateError) {
          throw updateError;
        }

        setAddMessage(
          "Matching vendor found! Increasing their discovery score instead of creating a duplicate."
        );
      } else {
        const initialAddCount = 1;
        const initialScore = Math.log10(initialAddCount + 1) * 5;
        const { error: insertError } = await supabase.from("vendors").insert({
          name: rawName,
          address: rawAddress,
          locality: rawLoc,
          speciality: rawSpeciality,
          add_attempt_count: initialAddCount,
          rating_sum: 0,
          rating_count: 0,
          score: initialScore,
        });

        if (insertError) {
          throw insertError;
        }

        setAddMessage("Vendor added. Thanks for contributing!");
      }

      const {
        vendors: refreshed,
        keyword: finalKeyword,
        locality: finalLocality,
      } = await searchVendors(keyword, rawLoc || locality);

      setKeyword(finalKeyword);
      setLocality(finalLocality);
      setVendors(refreshed);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to save vendor.";
      setAddMessage(message);
    } finally {
      setIsSavingVendor(false);
    }
  }

  function handleSelectRating(vendorId: string, value: number) {
    setSelectedRatings((prev) => ({ ...prev, [vendorId]: value }));
  }

  async function handleDeleteVendor(vendorId: string) {
    try {
      const { error } = await supabase
        .from("vendors")
        .delete()
        .eq("id", vendorId);

      if (error) {
        throw error;
      }

      setVendors((prev) => prev.filter((v) => v.id !== vendorId));
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to delete vendor.";
      setSearchError(message);
    }
  }

  async function handleRate(vendorId: string) {
    const rating = selectedRatings[vendorId];

    if (!rating || rating < 1 || rating > 5) {
      setRatingErrors((prev) => ({
        ...prev,
        [vendorId]: "Please choose a rating between 1 and 5 stars.",
      }));
      return;
    }

    setRatingLoading((prev) => ({ ...prev, [vendorId]: true }));
    setRatingErrors((prev) => ({ ...prev, [vendorId]: null }));

    try {
      const stars = Math.round(rating);

      // Debug log so you can inspect payload in the browser console
      console.log("Submitting Rating:", { vendor_id: vendorId, stars });

      const res = await fetch("/api/rate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vendor_id: vendorId, stars }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to submit rating.");
      }

      setToast("Rating submitted! Updating leaderboard...");
      window.setTimeout(() => setToast(null), 2500);

      setVendors((prev) =>
        prev.map((v) =>
          v.id === vendorId
            ? {
              ...v,
              score: data.score ?? v.score,
              rating_average: data.rating_average ?? v.rating_average,
              rating_count: data.rating_count ?? v.rating_count,
            }
            : v
        )
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to submit rating.";
      setRatingErrors((prev) => ({ ...prev, [vendorId]: message }));
    } finally {
      setRatingLoading((prev) => ({ ...prev, [vendorId]: false }));
    }
  }

  return (
    <main className="relative min-h-screen bg-white text-slate-900 dark:bg-slate-950 dark:text-white">
      {toast && (
        <div className="pointer-events-none fixed right-4 top-4 z-[60]">
          <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:text-slate-100">
            {toast}
          </div>
        </div>
      )}
      {isAdmin && (
        <button
          type="button"
          onClick={() => setIsAdmin(false)}
          className="fixed left-4 top-4 z-[55] inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-50/80 px-3 py-1 text-xs font-medium text-emerald-700 shadow-sm hover:bg-emerald-100 dark:border-emerald-400/40 dark:bg-emerald-900/60 dark:text-emerald-100"
        >
          🛡️ Admin Active
        </button>
      )}
      <div className="mx-auto flex min-h-screen max-w-4xl flex-col px-6 py-10 sm:py-16">
        <header className="mb-10 text-center">
          <div className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
            LocalRank
          </div>
          <h1 className="mt-6 text-balance text-5xl font-bold tracking-tight sm:text-6xl">
            LocalRank
          </h1>
          <p className="mt-4 text-pretty text-lg text-slate-600 dark:text-slate-400 sm:text-xl">
            Community-driven vendor rankings
          </p>
        </header>

        <section className="mx-auto w-full max-w-2xl">
          <form onSubmit={handleSearch} className="space-y-3">
            <label className="block text-left text-sm font-medium text-slate-700 dark:text-slate-300">
              What are you looking for and where?
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder='e.g. "Panipuri in Amraiwadi"'
                className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-3 text-base text-slate-900 placeholder-slate-400 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
              />
              <button
                type="submit"
                disabled={isSearching}
                className="shrink-0 rounded-xl bg-emerald-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-slate-50 disabled:cursor-not-allowed disabled:opacity-60 dark:focus:ring-offset-slate-950"
              >
                {isSearching ? "Searching…" : "Search"}
              </button>
            </div>
            {searchError && (
              <p className="text-sm text-red-500 dark:text-red-400">
                {searchError}
              </p>
            )}
          </form>
        </section>

        <section className="mt-10 flex-1">
          <div className="mb-4 flex items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
              {keyword
                ? `Results for "${keyword}"${locality ? ` in ${locality}` : ""
                }`
                : locality
                  ? `Top Rated in ${locality}`
                  : "Top vendors"}
            </h2>
            <button
              type="button"
              onClick={openAddModal}
              className="text-sm font-medium text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300"
            >
              Can&apos;t find a shop? Add it
            </button>
          </div>

          {vendors.length === 0 && !isSearching && !searchError && (
            <p className="text-sm text-slate-500 dark:text-slate-400">
              No vendors yet. Try a search or add the first shop in your area.
            </p>
          )}

          {vendors.length > 0 && (
            <ul className="space-y-3">
              {vendors.map((vendor) => (
                <li
                  key={vendor.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-slate-900 dark:text-white">
                        {vendor.name}
                      </h3>
                      {vendor.speciality && (
                        <div className="mt-1 flex flex-wrap gap-1">
                          {vendor.speciality
                            .split(",")
                            .map((raw) => raw.trim())
                            .filter(Boolean)
                            .map((spec) => (
                              <span
                                key={spec}
                                className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200"
                              >
                                {spec}
                              </span>
                            ))}
                        </div>
                      )}
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                        {vendor.address}
                      </p>
                      <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
                        {vendor.locality}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
                          Score: {vendor.score ?? 0}
                        </span>
                        {isAdmin && (
                          <button
                            type="button"
                            onClick={() => handleDeleteVendor(vendor.id)}
                            className="text-xs text-red-500 hover:text-red-400"
                            aria-label="Delete vendor"
                            title="Delete vendor"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                      {typeof vendor.add_attempt_count === "number" &&
                        vendor.add_attempt_count > 0 && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-500">
                            {vendor.add_attempt_count}{" "}
                            {vendor.add_attempt_count === 1
                              ? "person added this"
                              : "people added this"}
                          </span>
                        )}
                      {typeof vendor.rating_average === "number" &&
                        typeof vendor.rating_count === "number" && (
                          <span className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">
                            {vendor.rating_average.toFixed(1)} ·{" "}
                            {vendor.rating_count} rating
                            {vendor.rating_count === 1 ? "" : "s"}
                          </span>
                        )}
                    </div>
                  </div>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => {
                        const selected =
                          (selectedRatings[vendor.id] ?? 0) >= star;
                        return (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleSelectRating(vendor.id, star)}
                            className={`h-8 w-8 rounded-full text-base ${selected
                              ? "bg-amber-100 text-amber-500 dark:bg-amber-500/20 dark:text-amber-300"
                              : "bg-slate-100 text-slate-400 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-slate-700"
                              }`}
                            aria-label={`Rate ${star} star${star > 1 ? "s" : ""
                              }`}
                          >
                            ★
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRate(vendor.id)}
                        disabled={ratingLoading[vendor.id]}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {ratingLoading[vendor.id] ? "Rating…" : "Rate"}
                      </button>
                    </div>
                  </div>
                  {ratingErrors[vendor.id] && (
                    <p className="mt-1 text-xs text-red-500 dark:text-red-400">
                      {ratingErrors[vendor.id]}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        {isAddOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
            <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-xl">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">
                  Add a vendor
                </h2>
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  className="text-sm text-slate-400 hover:text-slate-200"
                >
                  Close
                </button>
              </div>

              <form onSubmit={handleSaveVendor} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-200">
                    Shop name
                  </label>
                  <input
                    type="text"
                    value={addName}
                    onChange={(e) => setAddName(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="e.g. Mathuravasi Chaat Centre"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200">
                    Speciality
                  </label>
                  <input
                    type="text"
                    value={addSpeciality}
                    onChange={(e) => setAddSpeciality(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="e.g. Panipuri, Goti Soda, Maskabun"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200">
                    Address
                  </label>
                  <input
                    type="text"
                    value={addAddress}
                    onChange={(e) => setAddAddress(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="Street and nearby landmark"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-200">
                    Locality <span className="text-emerald-400 font-normal ml-1">(Ahmedabad Only)</span>
                  </label>
                  <input
                    type="text"
                    value={addLocality}
                    onChange={(e) => setAddLocality(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="e.g. Amraiwadi"
                  />
                  <p className="mt-1.5 text-xs text-slate-400">
                    We are currently mapping street food in Ahmedabad only.
                  </p>
                </div>

                {addMessage && (
                  <p className="text-sm text-slate-200">{addMessage}</p>
                )}

                <div className="mt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsAddOpen(false)}
                    className="rounded-lg px-4 py-2 text-sm font-medium text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingVendor || !isAddFormValid}
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSavingVendor ? "Saving…" : "Save vendor"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
        {isAdminModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4">
            <div className="w-full max-w-xs rounded-2xl border border-slate-800 bg-slate-900 p-5 text-sm text-slate-100 shadow-2xl">
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-white">
                  Admin login
                </h2>
                <button
                  type="button"
                  onClick={() => {
                    setIsAdminModalOpen(false);
                    setAdminPassword("");
                    setAdminError(null);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-200"
                >
                  Close
                </button>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-300">
                    Password
                  </label>
                  <input
                    type="password"
                    value={adminPassword}
                    onChange={(e) => setAdminPassword(e.target.value)}
                    className="mt-1 block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white placeholder-slate-500 focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    placeholder="Enter admin password"
                  />
                </div>
                {adminError && (
                  <p className="text-xs text-red-400">{adminError}</p>
                )}
                <div className="mt-2 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAdminModalOpen(false);
                      setAdminPassword("");
                      setAdminError(null);
                    }}
                    className="rounded-lg px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (adminPassword === "Amdavad123") {
                        setIsAdmin(true);
                        setIsAdminModalOpen(false);
                        setAdminPassword("");
                        setAdminError(null);
                      } else {
                        setAdminError("Incorrect password.");
                      }
                    }}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                  >
                    Login
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="mt-6 flex items-center justify-end text-[10px] text-slate-500">
          <button
            type="button"
            onClick={() => {
              setAdminPassword("");
              setAdminError(null);
              setIsAdminModalOpen(true);
            }}
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] text-slate-400 hover:text-slate-600 dark:text-slate-600 dark:hover:text-slate-300"
          >
            <span className="text-[9px]">©</span>
            <span className="opacity-70">Admin</span>
          </button>
        </div>
      </div>
    </main>
  );
}
