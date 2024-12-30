import streamlit as st
import pandas as pd

st.set_page_config(layout="wide")

st.title("Rekap Nilai Tugas Audit Sistem Informasi UMN")
df = pd.read_csv("https://docs.google.com/spreadsheets/d/13GL9wjH-nT2qqsvMG2eYs8eMVZwEPADhKNaBArZDrec/export?format=csv&gid=2114973829")
df['NIM'] = df['NIM'].astype(str)
df['NIM'] = "000000"+df['NIM'].astype(str)
numeric_cols = df.columns[2:]
df[numeric_cols] = df[numeric_cols].applymap(lambda x: f"{x:.2f}" if pd.notnull(x) else x)
st.dataframe(df, hide_index=True, use_container_width=True, height=5000)
