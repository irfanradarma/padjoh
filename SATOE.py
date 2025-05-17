import streamlit as st
import pandas as pd
from supabase import create_client, Client
import uuid
from PIL import Image
import io
import base64

# Streamlit setup
st.set_page_config(layout="wide")
sheet_url = "https://docs.google.com/spreadsheets/d/1wYHIvmtuKeHHZeOgrrSTu1mkDsQsIc419XAUlfzQLoY/export?format=csv&gid=742196418"

# Supabase credentials
supabase_url = "https://clpcbkhqibxazlqpatvw.supabase.co"
supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscGNia2hxaWJ4YXpscXBhdHZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0ODE0NTEsImV4cCI6MjA2MzA1NzQ1MX0.FyEeR_gn-pVsDVKUmQF5IYA8_Z_hKjSoG_e7moXKG7k"
supabase: Client = create_client(supabase_url, supabase_key)

# Load participant data
@st.cache_data
def load_data(sheet_url):
    try:
        df = pd.read_csv(sheet_url)
        df = df[['NAMA LENGKAP', 'KELAS', 'PEKERJAAN / PROFESI SAAT INI', 
                 'NAMA INSTANSI / PERUSAHAAN / USAHA BISNIS', 
                 'Silahkan Isi Kota Domisili saat ini (Contoh: Kota Tangerang)']]
        df.columns = ['NAMA', 'KELAS', 'OKUPASI', 'INSTANSI', 'DOMISILI']
        return df
    except Exception as e:
        st.error(f"Error loading data: {e}")
        return pd.DataFrame()

# Upload image to Supabase table
def upload_image_to_table(image_file, kelas):
    image_bytes = image_file.read()
    base64_str = base64.b64encode(image_bytes).decode("utf-8")
    image_name = image_file.name

    data = {
        "kelas": kelas,
        "image_name": image_name,
        "image_data": base64_str
    }

    response = supabase.table("gallery_images").insert(data).execute()
    return response

# Fetch images from Supabase table by kelas
def fetch_images_from_table(kelas_list):
    all_images = []
    for kelas in kelas_list:
        response = supabase.table("gallery_images").select("*").eq("kelas", kelas).execute()
        if response.data:
            all_images.extend(response.data)
    return all_images

# Display image carousel from records
def image_carousel_from_db(image_records):
    for record in image_records:
        base64_img = record["image_data"]
        image_bytes = base64.b64decode(base64_img)
        image = Image.open(io.BytesIO(image_bytes))
        st.image(image, caption=record["image_name"], width=200)

# Main app logic
def main():
    if 'database' not in st.session_state:
        st.session_state.database = load_data(sheet_url)
    if 'shown' not in st.session_state:
        st.session_state.shown = st.session_state.database.copy()

    st.title('SATOE')

    # Filters
    col1, col2 = st.columns(2)

    with col1:
        st.session_state.kelas = st.multiselect(
            label='KELAS',
            options=['ALL'] + sorted(list(st.session_state.database['KELAS'].unique())),
            default='ALL'
        )
    with col2:
        st.session_state.okupasi = st.multiselect(
            label='OKUPASI',
            options=['ALL'] + sorted(list(st.session_state.database['OKUPASI'].unique())),
            default='ALL'
        )

    st.session_state.nama = st.text_input("Cari berdasarkan NAMA (bebas huruf besar/kecil):")

    # Apply filters
    st.session_state.shown = st.session_state.database.copy()
    if 'ALL' not in st.session_state.kelas:
        st.session_state.shown = st.session_state.shown[
            st.session_state.shown['KELAS'].isin(st.session_state.kelas)]
    if 'ALL' not in st.session_state.okupasi:
        st.session_state.shown = st.session_state.shown[
            st.session_state.shown['OKUPASI'].isin(st.session_state.okupasi)]
    if st.session_state.nama:
        st.session_state.shown = st.session_state.shown[
            st.session_state.shown['NAMA'].str.contains(st.session_state.nama, case=False)]

    st.session_state.shown = st.session_state.shown.drop_duplicates(
        subset=['NAMA', 'KELAS', 'OKUPASI', 'INSTANSI', 'DOMISILI'],
        keep='first'
    )

    st.dataframe(st.session_state.shown, use_container_width=True)
    st.markdown('---')

    # Image gallery
    if 'ALL' in st.session_state.kelas:
        kelas_filter = list(st.session_state.database['KELAS'].unique())
    else:
        kelas_filter = st.session_state.kelas

    st.subheader("Galeri Foto")
    image_records = fetch_images_from_table(kelas_filter)
    if image_records:
        image_carousel_from_db(image_records)
    else:
        st.info("Belum ada foto yang diunggah untuk filter KELAS ini.")

    st.markdown('---')

    # Upload section
    st.subheader("Upload Foto")
    uploaded_file = st.file_uploader("Pilih gambar untuk diunggah", type=["png", "jpg", "jpeg"])
    kelas_pilihan = st.selectbox("Pilih KELAS untuk gambar ini", options=['UMUM'] + sorted(list(st.session_state.database['KELAS'].unique())))

    if uploaded_file and kelas_pilihan:
        if st.button("Upload"):
            try:
                upload_image_to_table(uploaded_file, kelas_pilihan)
                st.success("Gambar berhasil diunggah ke database.")
            except Exception as e:
                st.error(f"Gagal mengunggah: {e}")

    st.markdown('---')

if __name__ == "__main__":
    main()
