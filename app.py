import streamlit as st
import pandas as pd
import datetime
import matplotlib.pyplot as plt
import seaborn as sns

# def viz_revenue(df):

def load_cash():
    df = pd.read_csv("https://docs.google.com/spreadsheets/d/1NtVj5P20IBdpNfClBhqW6egc8_atUn5VLf7_HdMC_tE/export?format=csv&gid=1161786680")
    return df

def week_data(df):
    df = df.pivot_table(index="Tanggal Jurnal", columns="Jenis", values="Jumlah").reset_index()
    df["Tanggal Jurnal"] = pd.to_datetime(df["Tanggal Jurnal"])
    df = df.resample('W-Mon', on='Tanggal Jurnal').sum().reset_index()
    df["Nett"] = df["Pemasukan"] - df["Pengeluaran"]
    # Round the numeric columns to zero decimal places
    numeric_columns = ['Pemasukan', 'Pengeluaran', 'Nett']
    df[numeric_columns] = df[numeric_columns].astype(int)
    return df


def plot_weekly_data(df):
    plt.figure(figsize=(10, 6))
    sns.lineplot(data=df[['Pemasukan', 'Pengeluaran']], markers=['o', 's'])
    plt.title('Weekly Income and Expense')
    plt.xlabel('Tanggal Jurnal')
    plt.ylabel('Amount (Rp)')
    plt.legend(['Pemasukan', 'Pengeluaran'])

    # Set x-axis ticks to represent proper dates without time
    plt.xticks(range(len(df['Tanggal Jurnal'])), df['Tanggal Jurnal'].dt.date, rotation=45, ha='right')

    st.pyplot(plt)

def main():
    st.title("Padjoh")
    tab_cash, tab_danil = st.tabs(["Cash Flow", "Lembur"])
    with tab_cash:
        col1, col2 = st.columns(2)
        with col1:
            start = st.date_input("start date:", datetime.date(2024, 1, 1))
        with col2:
            end = st.date_input("end date", datetime.datetime.now())
        df = week_data(load_cash())
        st.table(df)
        plot_weekly_data(df)
        st.link_button("Input Data Baru", "https://forms.gle/syy9USL6AcDVmxHN7")
    with tab_danil:
        st.write("nanti di sini ada kontrol jam kerja danil per bulan")
        st.link_button("Input Data Baru", "https://forms.gle/qpnVo48wLkURbYr77")

if __name__ == "__main__":
    main()
