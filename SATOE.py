import streamlit as st
import pandas as pd
from supabase import create_client, Client
import uuid

# Setup
st.set_page_config(layout="wide")
sheet_url = "https://docs.google.com/spreadsheets/d/1wYHIvmtuKeHHZeOgrrSTu1mkDsQsIc419XAUlfzQLoY/export?format=csv&gid=742196418"

# Supabase credentials
supabase_url = "https://clpcbkhqibxazlqpatvw.supabase.co"
supabase_key = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNscGNia2hxaWJ4YXpscXBhdHZ3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDc0ODE0NTEsImV4cCI6MjA2MzA1NzQ1MX0.FyEeR_gn-pVsDVKUmQF5IYA8_Z_hKjSoG_e7moXKG7k"
bucket_name = "satoe"

supabase: Client = create_client(supabase_url, supabase_key)

@st.cache_data
def load_data(sheet_url):
    try:
        df = pd.read_csv(sheet_url)
        df = df[['NAMA LENGKAP', 'KELAS', 'PEKERJAAN / PROFESI SAAT INI', 'NAMA INSTANSI / PERUSAHAAN / USAHA BISNIS', 'Silahkan Isi Kota Domisili saat ini (Contoh: Kota Tangerang)']]
        df.columns = ['NAMA', 'KELAS', 'OKUPASI', 'INSTANSI', 'DOMISILI']
        return df
    except Exception as e:
        st.error(f"Error loading data: {e}")
        return pd.DataFrame()

def upload_image_to_supabase(image_file, kelas):
    file_extension = image_file.name.split('.')[-1]
    unique_filename = f"{kelas}/{uuid.uuid4()}.{file_extension}"
    content = image_file.read()
    
    # Upload to bucket
    supabase.storage.from_(bucket_name).upload(unique_filename, content, {"content-type": image_file.type})
    
    return f"{supabase_url}/storage/v1/object/public/{bucket_name}/{unique_filename}"

def fetch_images_by_kelas(kelas_list):
    all_images = []
    storage = supabase.storage.from_(bucket_name)
    for kelas in kelas_list:
        files = storage.list(path=kelas)
        for file in files:
            public_url = f"{supabase_url}/storage/v1/object/public/{bucket_name}/{kelas}/{file['name']}"
            all_images.append(public_url)
    return all_images

def image_carousel(urls):
    for url in urls:
        st.image(url, width=200)

def main():
    if 'database' not in st.session_state:
        st.session_state.database = load_data(sheet_url)
    if 'shown' not in st.session_state:
        st.session_state.shown = st.session_state.database.copy()

    st.title('SATOE')
    col1, col2 = st.columns(2)

    with col1:
        st.session_state.kelas = st.multiselect(
            label='KELAS',
            options=['ALL'] + sorted(list(st.session_state.database['KELAS'].unique())),
            default='ALL')
    with col2:
        st.session_state.okupasi = st.multiselect(
            label='OKUPASI',
            options=['ALL'] + sorted(list(st.session_state.database['OKUPASI'].unique())),
            default='ALL')

    st.session_state.nama = st.text_input("Cari berdasarkan NAMA (bebas huruf besar/kecil):")

    # Filtering
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

    st.session_state.shown = st.session_state.shown.drop_duplicates(subset=['NAMA', 'KELAS', 'OKUPASI', 'INSTANSI', 'DOMISILI'], keep='first')
    st.dataframe(st.session_state.shown, use_container_width=True)
    st.markdown('---')

    # Display carousel
    if 'ALL' in st.session_state.kelas:
        kelas_filter = list(st.session_state.database['KELAS'].unique())
    else:
        kelas_filter = st.session_state.kelas

    st.subheader("Galeri Foto")
    urls = fetch_images_by_kelas(kelas_filter)
    if urls:
        image_carousel(urls)
    else:
        st.info("Belum ada foto yang diunggah untuk filter KELAS ini.")
    st.markdown('---')

    # Upload section
    st.subheader("Upload Foto")
    uploaded_file = st.file_uploader("Pilih gambar untuk diunggah", type=["png", "jpg", "jpeg"])
    kelas_pilihan = st.selectbox("Pilih KELAS untuk gambar ini", options=sorted(list(st.session_state.database['KELAS'].unique())))

    if uploaded_file and kelas_pilihan:
        if st.button("Upload"):
            try:
                url = upload_image_to_supabase(uploaded_file, kelas_pilihan)
                st.success(f"Gambar berhasil diunggah: {url}")
            except Exception as e:
                st.error(f"Gagal mengunggah: {e}")

    st.markdown('---')


if __name__ == "__main__":
    main()
