import streamlit as st
import pandas as pd
import datetime
import matplotlib.pyplot as plt
import matplotlib.ticker as ticker
import seaborn as sns

st.set_page_config(layout="centered", page_title="Padjoh Journals")

data_dummy = "https://docs.google.com/spreadsheets/d/1NtVj5P20IBdpNfClBhqW6egc8_atUn5VLf7_HdMC_tE/export?format=csv&gid=1161786680"
data_real = "https://docs.google.com/spreadsheets/d/15HrkvSVfOakXgYKk-CIPFea0BivaEaQdxirQsvImvFk/export?format=csv&gid=1189388432"

def load_cash(drop='T'):
    df = pd.read_csv(data_real)
    df = df.drop(['Timestamp'], axis=1)
    df['Jumlah'] = df['Jumlah'].astype(int)
    df['Tanggal Jurnal'] = pd.to_datetime(df['Tanggal Jurnal'])
    if drop == 'T':
        df = df.drop(['Keterangan'], axis=1)
    return df

def pivoting(df):
    df = df.pivot_table(index="Tanggal Jurnal", columns="Jenis", values="Jumlah",  aggfunc='sum').reset_index()
    df.fillna(0, inplace=True)
    return df

def month_data(df):
    df = pivoting(df)
    df = df.resample('M', on='Tanggal Jurnal').sum().reset_index()
    df["Nett"] = df["Pemasukan"] - df["Pengeluaran"]
    df['Bulan'] = df['Tanggal Jurnal'].dt.month_name()
    cols = df.columns.tolist()
    cols = cols[-1:] + cols[:-1]
    df = df[cols]
    return df

def daily_data(df):
    df = pivoting(df)
    df["Nett"] = df["Pemasukan"] - df["Pengeluaran"]
    return df

def plot_monthly_data(df):
    df_viz = pd.melt(df, id_vars=['Bulan'], value_vars=['Pemasukan', 'Pengeluaran'])
    plt.figure(figsize=(10, 6))
    sns.barplot(x="Bulan",
            y="value",
            hue="Jenis",
            data=df_viz,
            palette="Set2")
    plt.title('Rekap Bulanan')
    plt.xlabel('Bulan')
    plt.ylabel('Amount (Rp)')

    formatter = ticker.FuncFormatter(lambda x, pos: '{:,.0f}'.format(x))
    plt.gca().yaxis.set_major_formatter(formatter)
    for p in plt.gca().patches:
        plt.gca().annotate('{:,.0f}'.format(p.get_height()), 
                            (p.get_x() + p.get_width() / 2., p.get_height()), 
                            ha='center', va='center', 
                            fontsize=10, color='black', 
                            xytext=(0, 5), 
                            textcoords='offset points')

    plt.tight_layout()
    st.pyplot(plt)

def main():
    st.title("Padjoh :coffee:")
    tab_cash, tab_custom = st.tabs(["Cash Flow", "Custom View"])
    with tab_cash:
        df_d = daily_data(load_cash())
        df_d['Tanggal Jurnal'] = df_d['Tanggal Jurnal'].dt.strftime('%b-%d')
        df_d = df_d.rename(columns={'Tanggal Jurnal': 'Tanggal'})
        st.dataframe(df_d, hide_index=True)
        st.link_button("Input Data Baru", "https://forms.gle/BATMEaJSGeY4TMkR7")
        with st.expander("Rekap Bulanan"):
            df_m = month_data(load_cash())
            st.dataframe(df_m.drop(['Tanggal Jurnal'], axis=1), hide_index=True)
            plot_monthly_data(df_m)    
    with tab_custom:
        col1, col2 = st.columns(2)
        with col1:
            start = st.date_input("start date:", datetime.date(2024, 1, 1))
        with col2:
            end = st.date_input("end date", datetime.datetime.now())
        df_d_custom = daily_data(load_cash())
        df_d_custom['Tanggal Jurnal'] = df_d_custom['Tanggal Jurnal'].dt.date
        df_d_custom = df_d_custom[(df_d_custom['Tanggal Jurnal'] >= start) & (df_d_custom['Tanggal Jurnal'] <= end)]
        df_d_custom = df_d_custom.rename(columns={'Tanggal Jurnal': 'Tanggal'})        
        if st.button('Show'):
            tab_income, tab_expense = st.tabs(["Pemasukan", "Pengeluaran"])
            with tab_income:
                df_custom = df_d_custom.copy()
                df_custom = df_custom.drop(['Nett', 'Pengeluaran'], axis=1)
                df_custom['Tanggal'] = pd.to_datetime(df_custom['Tanggal']).dt.strftime('%b-%d')
                df_custom.sort_values(by='Tanggal', inplace=True)
                st.dataframe(df_custom, hide_index=True)
            with tab_expense:
                df_out_custom = load_cash(drop='F')
                df_out_custom = df_out_custom[df_out_custom['Jenis'] == 'Pengeluaran']
                df_out_custom = df_out_custom[(pd.to_datetime(df_out_custom['Tanggal Jurnal']).dt.date >= start)
                                            & (pd.to_datetime(df_out_custom['Tanggal Jurnal']).dt.date <= end)]
                df_out_custom['Tanggal Jurnal'] = df_out_custom['Tanggal Jurnal'].dt.strftime('%b-%d')
                df_out_custom = df_out_custom.rename(columns={'Tanggal Jurnal': 'Tanggal'})
                df_out_custom = df_out_custom[['Tanggal', 'Keterangan', 'Jumlah']]
                df_out_custom.sort_values(by='Tanggal', inplace=True)
                st.dataframe(df_out_custom, hide_index=True)
        else:
            st.empty()


        # st.link_button("Input Data Baru", "https://forms.gle/qpnVo48wLkURbYr77")

if __name__ == "__main__":
    main()
