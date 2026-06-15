import { useState, useEffect, useRef } from "react";
import jsPDF from "jspdf";
import dayjs from "dayjs";
import autoTable from "jspdf-autotable";
import Logo from "../assets/LogoQuatenus.png";
import axios from "axios";

const DeviceSelectionModal = ({ show, onClose, calculatedData, contract, requestDate, getCancelDate }) => {
  const [selectedDevicesQuantity, setSelectedDevicesQuantity] = useState({});
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [devices, setDevices] = useState({});
  const modalContentRef = useRef();
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (show && calculatedData.length > 0) {
      initializeDeviceSelections();
      getDevices();
    }
  }, [show, calculatedData]);

  const initializeDeviceSelections = () => {
    const initialSelections = {};
    calculatedData.forEach((item) => {
      initialSelections[item.itemId] = Array(item.quantity).fill("");
    });
    setSelectedDevicesQuantity(initialSelections);
  };

  const getDevices = async () => {
    setDevices({});
    setLoading(true);

    try {
      const devicePromises = calculatedData.map(async (item) => {
        if (!item.QbmDocumentItemId) {
          return { itemId: item.itemId, devices: [] };
        }

        const body = {
          documentItemId: item.QbmDocumentItemId,
          cultureInfo: "pt-BR",
          timeZoneId: "E. South America Standard Time",
          userName: localStorage.getItem("qbmUsername"),
          password: localStorage.getItem("qbmPassword"),
        };

        try {
          const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/GetExternalContractsItemsDevices`, body);
          const deviceCodes = response.data.Rows.filter((device) => device.IsEnabled === true).map((device) => device.DeviceCode);
          return { itemId: item.itemId, devices: deviceCodes };
        } catch (error) {
          console.error("Erro ao buscar dispositivos para item:", item.QbmItemCode, error);
          return { itemId: item.itemId, devices: [] };
        }
      });

      const results = await Promise.all(devicePromises);
      const devicesMap = {};
      results.forEach((result) => {
        devicesMap[result.itemId] = result.devices;
      });

      setDevices(devicesMap);
    } catch (error) {
      console.error("Erro geral ao buscar dispositivos:", error);
      alert("Erro ao buscar dispositivos. Entre em contato com o suporte.");
    } finally {
      setLoading(false);
    }
  };

  const handleDeviceChange = (itemId, index, deviceId) => {
    setSelectedDevicesQuantity((prev) => {
      const newSelections = { ...prev };
      if (!newSelections[itemId]) {
        newSelections[itemId] = [];
      }
      newSelections[itemId][index] = deviceId;
      return newSelections;
    });
  };

  const handleConfirm = async () => {
    const allValid = calculatedData.every((item) => {
      const selections = selectedDevicesQuantity[item.itemId] || [];
      return selections.length === item.quantity && selections.every((selection) => selection && selection.trim() !== "");
    });

    if (!allValid) {
      alert("Por favor, selecione um dispositivo ou N/A para todas as linhas.");
      return;
    }

    await generatePDF();
  };

  const generatePDF = async () => {
    setIsGeneratingPDF(true);

    try {
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = 210;
      const margin = 15;

      const addHeader = () => {
        const logoWidth = 32; // largura da logo em mm
        const logoHeight = 10; // altura da logo em mm
        pdf.addImage(Logo, "PNG", pageWidth - margin - logoWidth, 8, logoWidth, logoHeight);

        pdf.setFontSize(16);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text("MEMORIAL DE CANCELAMENTO", margin, 15);

        pdf.setDrawColor(220, 220, 220);
        pdf.setLineWidth(0.2);
        pdf.line(margin, 22, pageWidth - margin, 22);

        pdf.setTextColor(0, 0, 0);
      };

      addHeader();

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      let yPosition = 30;

      pdf.text(`${contract.CustomerBusinessEntityDescription}`, margin, yPosition);
      yPosition += 5;

      pdf.setFontSize(10);
      pdf.setFont("helvetica", "normal");

      pdf.text(`N° Contrato: ${contract.QbmDocumentId}`, margin, yPosition);
      yPosition += 10;

      pdf.setFont("helvetica", "bold");
      pdf.text("Data do Contrato:", margin, yPosition);
      pdf.setFont("helvetica", "normal");
      pdf.text(contract.DocumentDateToGrid.split(" ")[0], margin, yPosition + 5);

      pdf.setFont("helvetica", "bold");
      pdf.text("Data da Solicitação:", margin + 60, yPosition);
      pdf.setFont("helvetica", "normal");
      pdf.text(dayjs(requestDate).format("DD/MM/YYYY"), margin + 60, yPosition + 5);

      pdf.setFont("helvetica", "bold");
      pdf.text("Data de Encerramento:", margin + 120, yPosition);
      pdf.setFont("helvetica", "normal");
      pdf.text(getCancelDate().format("DD/MM/YYYY"), margin + 120, yPosition + 5);

      yPosition += 15;

      pdf.setFontSize(12);
      pdf.setFont("helvetica", "bold");
      pdf.text("Detalhamento das Licenças a Cancelar:", margin, yPosition);
      yPosition += 5;

      calculatedData.forEach((item, index) => {
        const rectStartY = yPosition;

        const contentHeight = 5 + 5 + 4 + 5; // espaçamento + título + quantidade + fidelidade

        // Desenha o retângulo de fundo
        pdf.setFillColor(248, 249, 250);
        pdf.rect(margin, rectStartY, pageWidth - margin * 2, contentHeight, "F");

        yPosition += 5;

        // Conteudo
        pdf.setFontSize(12);
        pdf.setFont("helvetica", "bold");
        pdf.setTextColor(0, 0, 0);
        pdf.text(`${item.QbmItemCode}`, margin + 3, yPosition);
        yPosition += 5;

        pdf.setFontSize(10);
        pdf.setFont("helvetica", "normal");
        pdf.setTextColor(255, 107, 53);
        pdf.text(`Quantidade a cancelar: ${item.quantity}`, margin + 3, yPosition);
        yPosition += 4;

        pdf.setTextColor(0, 0, 0);
        pdf.setFontSize(10);
        pdf.text(`Fidelidade Restante: ${item.fidelityDisplay}`, margin + 3, yPosition);
        yPosition += 3;

        const tableData = [];
        const deviceSelections = selectedDevicesQuantity[item.itemId] || [];

        for (let i = 0; i < item.quantity; i++) {
          tableData.push([
            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.UnitPrice),
            `${item.percentage}%`,
            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.finePerUnit),
            new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.fee),
            deviceSelections[i] || "N/A",
          ]);
        }

        autoTable(pdf, {
          startY: yPosition,
          head: [["Pr. Unitário", "Multa Contratual (%)", "Multa", "Taxa de Finalização", "Placa do Veículo"]],
          body: tableData,
          theme: "grid",
          styles: {
            fontSize: 9,
            cellPadding: 2,
          },
          headStyles: {
            fillColor: "#f36e21",
            textColor: 255,
            fontStyle: "bold",
          },
          margin: { left: margin, right: margin },
          pageBreak: "auto",
          showHead: "everyPage",
        });

        yPosition = pdf.lastAutoTable.finalY + 15;

        if (index < calculatedData.length - 1 && yPosition > 240) {
          pdf.addPage();
          yPosition = 25;
        }
      });

      const total = calculatedData.reduce((acc, item) => acc + item.total, 0);

      if (yPosition > 260) {
        pdf.addPage();
        yPosition = 25;
      }

      pdf.setFillColor("#f36e21");
      pdf.rect(margin, yPosition, pageWidth - margin * 2, 15, "F");

      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(14);
      pdf.setFont("helvetica", "bold");
      pdf.text(`TOTAL: ${new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}`, pageWidth / 2, yPosition + 10, {
        align: "center",
      });

      pdf.setTextColor(0, 0, 0);

      const now = dayjs();
      const timestamp = now.format("DD-MM-YYYY_HH-mm-ss");
      const fileName = `Memorial_Cancelamento_${contract.QbmDocumentId}_${timestamp}.pdf`;

      pdf.save(fileName);
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      alert("Erro ao gerar o PDF. Tente novamente.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleClose = () => {
    setSelectedDevicesQuantity({});
    onClose();
  };

  if (!show) return null;

  const total = calculatedData.reduce((total, item) => total + item.total, 0);

  return (
    <>
      <div className="modal-backdrop fade show"></div>
      <div className="modal fade show d-block" tabIndex="-1">
        <div className="modal-dialog modal-xl">
          <div className="modal-content" ref={modalContentRef}>
            <div className="modal-header">
              <h5 className="modal-title">Memorial de Cobrança - Contrato: {contract.QbmDocumentId}</h5>
              <button type="button" className="btn-close" onClick={handleClose}></button>
            </div>
            <div className="modal-body">
              <div className="mb-3 p-3 bg-light rounded">
                <h6 className="mb-3">
                  <strong>Informações do Contrato</strong>
                </h6>
                <div className="row">
                  <div className="col-md-4">
                    <p className="mb-2">
                      <strong>Data do Contrato:</strong>
                      <br />
                      {contract.DocumentDateToGrid.split(" ")[0]}
                    </p>
                  </div>
                  <div className="col-md-4">
                    <p className="mb-2">
                      <strong>Data da Solicitação:</strong>
                      <br />
                      {dayjs(requestDate).format("DD/MM/YYYY")}
                    </p>
                  </div>
                  <div className="col-md-4">
                    <p className="mb-2">
                      <strong>Data de Encerramento:</strong>
                      <br />
                      {getCancelDate().format("DD/MM/YYYY")}
                    </p>
                  </div>
                </div>
              </div>

              <p className="mb-3">
                <strong>Detalhamento das Licenças a Cancelar:</strong>
              </p>

              {calculatedData.map((item) => {
                const deviceSelections = selectedDevicesQuantity[item.itemId] || [];
                const itemDevices = devices[item.itemId] || [];

                // Função para obter devices disponíveis para cada linha
                const getAvailableDevices = (currentIndex) => {
                  const selectedInThisItem = deviceSelections.filter((_, idx) => idx !== currentIndex);
                  return itemDevices.filter((device) => !selectedInThisItem.includes(device));
                };

                return (
                  <div key={item.itemId} className="mb-4 p-3 border rounded">
                    <div className="row mb-3">
                      <div className="col">
                        <strong>{item.QbmItemCode}</strong>
                        <div className="text-muted small">{item.QbmItemDescription}</div>
                        <div className="text-qorange small">Quantidade a cancelar: {item.quantity}</div>
                      </div>
                    </div>

                    <div className="row">
                      <div className="col">
                        <table className="table table-sm table-bordered">
                          <thead>
                            <tr>
                              <th>
                                <p className="m-0 p-0">Pr. Unitário</p>
                              </th>
                              <th>
                                <p className="m-0 p-0 link-qorange" title={import.meta.env.VITE_TITLE_MULTA}>
                                  Multa Contratual (%)
                                </p>
                              </th>
                              <th>
                                <p className="m-0 p-0">Multa</p>
                              </th>
                              <th>
                                <p className="m-0 p-0 link-qorange" title={import.meta.env.VITE_TITLE_TAXA_FINALIZACAO}>
                                  Taxa de Finalização
                                </p>
                              </th>
                              <th>
                                <p className="m-0 p-0">Placa do Veículo</p>
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {Array.from({ length: item.quantity }, (_, index) => (
                              <tr key={index}>
                                <td className="align-middle">
                                  {new Intl.NumberFormat("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  }).format(item.UnitPrice)}
                                </td>
                                <td className="align-middle text-center">{item.percentage}%</td>
                                <td className="align-middle">
                                  {new Intl.NumberFormat("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  }).format(item.finePerUnit)}
                                </td>
                                <td className="align-middle">
                                  {new Intl.NumberFormat("pt-BR", {
                                    style: "currency",
                                    currency: "BRL",
                                  }).format(item.fee)}
                                </td>
                                {loading ? (
                                  <td className="form-control form-control-sm">Carregando dispositivos...</td>
                                ) : (
                                  <td>
                                    <select
                                      className="form-select form-select-sm"
                                      value={deviceSelections[index] || ""}
                                      onChange={(e) => handleDeviceChange(item.itemId, index, e.target.value)}>
                                      <option value="">Selecione um dispositivo</option>
                                      <option value="N/A">N/A</option>
                                      {getAvailableDevices(index).map((device, deviceIndex) => (
                                        <option key={deviceIndex} value={device}>
                                          {device}
                                        </option>
                                      ))}
                                    </select>
                                  </td>
                                )}
                              </tr>
                            ))}
                          </tbody>
                        </table>

                        <div className="mt-2 p-2 bg-light rounded">
                          <div className="row">
                            <div className="col-md-6">
                              <small>
                                <strong>Fidelidade Restante:</strong> {item.fidelityDisplay}
                              </small>
                            </div>
                            <div className="col-md-6 text-end">
                              <small>
                                <strong>Total do Item:</strong>{" "}
                                {new Intl.NumberFormat("pt-BR", {
                                  style: "currency",
                                  currency: "BRL",
                                }).format(item.total)}
                              </small>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              <div className="mt-4 p-3 bg-qorange text-white rounded text-center">
                <h5 className="mb-0">
                  <strong>
                    TOTAL:{" "}
                    {new Intl.NumberFormat("pt-BR", {
                      style: "currency",
                      currency: "BRL",
                    }).format(total)}
                  </strong>
                </h5>
              </div>
            </div>
            <div className="modal-footer">
              <button type="button" className="btn btn-sm btn-secondary" onClick={handleClose}>
                Voltar
              </button>
              <button type="button" className="btn btn-sm btn-qorange" onClick={handleConfirm} disabled={isGeneratingPDF}>
                {isGeneratingPDF ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status"></span>
                    Gerando PDF...
                  </>
                ) : (
                  "Gerar Memorial"
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DeviceSelectionModal;
