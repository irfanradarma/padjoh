import streamlit as st
import pandas as pd
from supabase import create_client, Client
import uuid
from io import BytesIO

# Supabase credentials
supabase_url = "https://clpcbkhqibxazlqpatvw.supabase.co"
supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscGNia2hxaWJ4YXpscXBhdHZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0ODE0NTEsImV4cCI6MjA2MzA1NzQ1MX0.FyEeR_gn-pVsDVKUmQF5IYA8_Z_hKjSoG_e7moXKG7k"
supabase: Client = create_client(supabase_url, supabase_key)

# Google Sheet
sheet_url = "https://docs.google.com/spreadsheets/d/1wYHIvmtuKeHHZeOgrrSTu1mkDsQsIc419XAUlfzQLoY/export?format=csv&gid=742196418"

@st.cache_data
def load_data(sheet_url):
    df = pd.read_csv(sheet_url)
    df = df[['NAMA LENGKAP', 'KELAS', 'PEKERJAAN / PROFESI SAAT INI', 'NAMA INSTANSI / PERUSAHAAN / USAHA BISNIS', 'Silahkan Isi Kota Domisili saat ini (Contoh: Kota Tangerang)']]
    df.columns = ['NAMA', 'KELAS', 'OKUPASI', 'INSTANSI', 'DOMISILI']
    return df

def upload_image_to_table(image_file, kelas):
    content = image_file.read()
    file_name = image_file.name
    data = {
        "id": str(uuid.uuid4()),
        "kelas": kelas,
        "filename": file_name,
        "image": content,
    }
    result = supabase.table("gallery").insert(data).execute()
    return result

def fetch_images_by_kelas(kelas_list):
    if not kelas_list:
        return []
    query = supabase.table("gallery").select("*")
    if "ALL" not in kelas_list:
        query = query.in_("kelas", kelas_list)
    response = query.execute()
    return response.data

def image_carousel_from_table(records):
    for rec in records:
        image_bytes = rec["image"]
        st.image(BytesIO(image_bytes), caption=rec.get("filename", ""), width=200)

def main():
    st.set_page_config(layout="wide")
    st.title('SATOE')

    if 'database' not in st.session_state:
        st.session_state.database = load_data(sheet_url)

    col1, col2 = st.columns(2)
    with col1:
        kelas_filter = st.multiselect(
            'KELAS',
            options=['ALL'] + sorted(st.session_state.database['KELAS'].unique()),
            default='ALL')
    with col2:
        okupasi_filter = st.multiselect(
            'OKUPASI',
            options=['ALL'] + sorted(st.session_state.database['OKUPASI'].unique()),
            default='ALL')

    nama_filter = st.text_input("Cari berdasarkan NAMA (bebas huruf besar/kecil):")

    # Apply filters
    shown = st.session_state.database.copy()
    if "ALL" not in kelas_filter:
        shown = shown[shown['KELAS'].isin(kelas_filter)]
    if "ALL" not in okupasi_filter:
        shown = shown[shown['OKUPASI'].isin(okupasi_filter)]
    if nama_filter:
        shown = shown[shown['NAMA'].str.contains(nama_filter, case=False)]

    st.dataframe(shown.drop_duplicates(), use_container_width=True)
    st.markdown("---")

    # Display images
    st.subheader("Galeri Foto")
    fetch_kelas = (
        list(st.session_state.database['KELAS'].unique())
        if "ALL" in kelas_filter
        else kelas_filter
    )
    images = fetch_images_by_kelas(fetch_kelas)
    if images:
        image_carousel_from_table(images)
    else:
        st.info("Belum ada foto yang diunggah untuk filter ini.")
    st.markdown("---")

    # Upload section
    st.subheader("Upload Foto")
    uploaded_file = st.file_uploader("Pilih gambar", type=["png", "jpg", "jpeg"])
    kelas_pilihan = st.selectbox("Pilih KELAS untuk gambar ini", sorted(st.session_state.database['KELAS'].unique()))
    if uploaded_file and kelas_pilihan:
        if st.button("Upload"):
            try:
                upload_image_to_table(uploaded_file, kelas_pilihan)
                st.success("Gambar berhasil diunggah.")
            except Exception as e:
                st.error(f"Gagal mengunggah gambar: {e}")

if __name__ == "__main__":
    main()
